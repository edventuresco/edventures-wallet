// On-chain side of the family model: kid wallets, kid device roles, and the
// transactions a guardian signs. Server-only (uses the fee payer).

import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { createEd25519AuthorityInfo, fetchSwig, getAddAuthorityInstructions, getUpdateAuthorityInstructions, updateAuthorityReplaceAllActions } from "@swig-wallet/classic";
import { getConnection } from "@/lib/solana/connection";
import { keypairFromEnv } from "@/lib/solana/keys";
import { usdcMint } from "@/lib/solana/mint";
import { createWallet, roleIdFor } from "@/lib/swig/wallet";
import { measureSlotMs, spendWindowSlots, WEEK_MS } from "@/lib/swig/windows";
import { DEFAULTS } from "./defaults";
import { kidRolePlans, RULE_SYNC_WALLETS, type KidRolePlan, type WalletKind } from "./roles";

const DAY_MS = 24 * 60 * 60 * 1000;
let slotMsCache: { at: number; ms: number } | null = null;

/** Measured slot time, cached for ten minutes; sizes the recurring-limit windows. */
export async function slotMs(): Promise<number> {
  if (slotMsCache && Date.now() - slotMsCache.at < 10 * 60_000) return slotMsCache.ms;
  const ms = await measureSlotMs(getConnection());
  slotMsCache = { at: Date.now(), ms };
  return ms;
}

export type KidWalletSet = Record<"spend" | "save" | "share", { swigAddress: string; walletAddress: string; signature: string }>;

/** Three Swig wallets per kid, root = the guardian's device key, fee payer pays. */
export async function createKidWallets(root: PublicKey): Promise<KidWalletSet> {
  const connection = getConnection();
  const payer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const out = {} as KidWalletSet;
  for (const kind of ["spend", "save", "share"] as const) {
    const w = await createWallet({ connection, payer, root });
    out[kind] = { swigAddress: w.swigAddress.toBase58(), walletAddress: w.walletAddress.toBase58(), signature: w.signature };
  }
  return out;
}

export function ataFor(owner: string): PublicKey {
  return getAssociatedTokenAddressSync(usdcMint(), new PublicKey(owner), true);
}

export type ApproveDeviceInput = {
  guardianDevicePubkey: string;
  kidDevicePubkey: string;
  wallets: Record<WalletKind, { swigAddress: string; walletAddress: string }>;
  /** Active contacts: wallet addresses (owners) with their weekly caps. */
  contacts: Array<{ address: string; weeklyUnits: bigint }>;
  dailyLimitUnits: bigint;
};

/** The kid role's permissions on each wallet, from the current rules. */
async function plansFor(input: Pick<ApproveDeviceInput, "wallets" | "contacts" | "dailyLimitUnits">): Promise<KidRolePlan[]> {
  const ms = await slotMs();
  return kidRolePlans({
    mint: usdcMint(),
    weeklySlots: spendWindowSlots(WEEK_MS, ms),
    dailySlots: spendWindowSlots(DAY_MS, ms),
    atas: { spend: ataFor(input.wallets.spend.walletAddress), save: ataFor(input.wallets.save.walletAddress), share: ataFor(input.wallets.share.walletAddress) },
    contactLimits: input.contacts.map((c) => ({ destinationAta: ataFor(c.address), recurringAmount: c.weeklyUnits })),
    dailyLimitUnits: input.dailyLimitUnits,
    jarWeeklyUnits: DEFAULTS.jarWeeklyUnits,
  });
}

async function finalize(tx: Transaction, feePayer: Keypair): Promise<{ tx: Transaction; feePayer: Keypair }> {
  tx.feePayer = feePayer.publicKey;
  tx.recentBlockhash = (await getConnection().getLatestBlockhash("confirmed")).blockhash;
  return { tx, feePayer };
}

/**
 * One transaction that adds the kid's device as a limited role on all three
 * wallets. The guardian's device signs as root.
 */
export async function buildApproveDeviceTx(input: ApproveDeviceInput): Promise<{ tx: Transaction; feePayer: Keypair }> {
  const connection = getConnection();
  const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const root = new PublicKey(input.guardianDevicePubkey);
  const kidKey = createEd25519AuthorityInfo(new PublicKey(input.kidDevicePubkey));

  const tx = new Transaction();
  for (const plan of await plansFor(input)) {
    const swig = await fetchSwig(connection, new PublicKey(input.wallets[plan.kind].swigAddress));
    const rootRoleId = roleIdFor(swig, root);
    const ixs = await getAddAuthorityInstructions(swig, rootRoleId, kidKey, plan.actions, { payer: feePayer.publicKey });
    tx.add(...ixs);
  }
  return finalize(tx, feePayer);
}

export type RuleSyncInput = Omit<ApproveDeviceInput, "kidDevicePubkey"> & {
  /** Every active device the kid has; each holds a role on each wallet. */
  kidDevicePubkeys: string[];
};

/**
 * One transaction that rewrites each kid device's role on the wallets the
 * rules touch (spend and share) so the chain matches the current contacts
 * and daily total. Replace, not add: a lowered cap must go down. The
 * guardian's device signs as root. Throws when a device has no role on a
 * wallet (it was never approved there).
 */
export async function buildRuleSyncTx(input: RuleSyncInput): Promise<{ tx: Transaction; feePayer: Keypair }> {
  if (input.kidDevicePubkeys.length === 0) throw new Error("buildRuleSyncTx: no kid devices to update");
  const connection = getConnection();
  const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const root = new PublicKey(input.guardianDevicePubkey);
  const plans = (await plansFor(input)).filter((p) => RULE_SYNC_WALLETS.includes(p.kind));

  const tx = new Transaction();
  for (const plan of plans) {
    const swig = await fetchSwig(connection, new PublicKey(input.wallets[plan.kind].swigAddress));
    const rootRoleId = roleIdFor(swig, root);
    for (const pubkey of input.kidDevicePubkeys) {
      // Role ids are per wallet; read them from the chain rather than trusting a stored one.
      const kidRoleId = roleIdFor(swig, new PublicKey(pubkey));
      const ixs = await getUpdateAuthorityInstructions(swig, rootRoleId, kidRoleId, updateAuthorityReplaceAllActions(plan.actions), { payer: feePayer.publicKey });
      tx.add(...ixs);
    }
  }
  return finalize(tx, feePayer);
}

/** After the approve transaction lands: the kid device's role id on each wallet. */
export async function readKidRoleIds(kidDevicePubkey: string, wallets: Record<"spend" | "save" | "share", { swigAddress: string }>) {
  const connection = getConnection();
  const key = new PublicKey(kidDevicePubkey);
  const out: Record<"spend" | "save" | "share", number> = { spend: -1, save: -1, share: -1 };
  for (const kind of ["spend", "save", "share"] as const) {
    const swig = await fetchSwig(connection, new PublicKey(wallets[kind].swigAddress));
    out[kind] = roleIdFor(swig, key);
  }
  return out;
}
