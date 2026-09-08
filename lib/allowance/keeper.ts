/**
 * The on-chain allowance transfer. Server-only: it holds the fee payer, which
 * is also the keeper authority on the family treasury (lib/family/keeper.ts).
 *
 * One transaction moves the allowance out of the family wallet into the kid's
 * three jars in their chosen split. The keeper role signs the transfers within
 * its weekly cap; the fee payer pays, and creates any jar token account that
 * does not exist yet. Throws before sending anything when the keeper is not
 * set up or the treasury is short, so callers record nothing on failure.
 */

import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferInstruction, getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fetchSwig, getSignInstructions } from "@swig-wallet/classic";
import { keeperRoleOf } from "@/lib/family/keeper";
import { ataFor } from "@/lib/family/onchain";
import { JAR_KINDS, splitUnits, type SplitUnits } from "@/lib/family/split";
import { unitsToDisplay } from "@/lib/money/usdc";
import { getConnection } from "@/lib/solana/connection";
import { keypairFromEnv } from "@/lib/solana/keys";
import { usdcMint } from "@/lib/solana/mint";
import { sendTx } from "@/lib/solana/tx";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type AllowanceTransfer = {
  familyId: string;
  kidId: string;
  amountUnits: bigint;
};

export type AllowanceReceipt = { signature: string; split: SplitUnits };

/** A reason the allowance could not go out, found before anything was sent. Plain enough to show a guardian. */
export class AllowanceError extends Error {
  readonly name = "AllowanceError";
}

type JarKind = (typeof JAR_KINDS)[number];
type FamilyRecord = { keeper_role_id: number | null };
type TreasuryRecord = { swig_address: string; wallet_address: string };
type KidRecord = { spend_pct: number; save_pct: number; share_pct: number };
type JarRecord = { kind: JarKind; wallet_address: string };

export async function sendAllowanceOnChain(transfer: AllowanceTransfer): Promise<AllowanceReceipt> {
  const { familyId, kidId, amountUnits } = transfer;
  if (amountUnits <= 0n) throw new AllowanceError("An allowance needs to be above zero.");
  const admin = getSupabaseAdmin();
  if (!admin) throw new AllowanceError("Allowances aren't available right now.");

  const [familyResult, treasuryResult, kidResult, jarsResult] = await Promise.all([
    admin.from("families").select("keeper_role_id").eq("id", familyId).maybeSingle(),
    admin.from("wallets").select("swig_address,wallet_address").eq("family_id", familyId).eq("kind", "family").maybeSingle(),
    admin.from("kids").select("spend_pct,save_pct,share_pct").eq("id", kidId).eq("family_id", familyId).maybeSingle(),
    admin.from("wallets").select("kind,wallet_address").eq("kid_id", kidId).eq("family_id", familyId).in("kind", [...JAR_KINDS]),
  ]);
  const family = familyResult.data as FamilyRecord | null;
  const treasury = treasuryResult.data as TreasuryRecord | null;
  const kid = kidResult.data as KidRecord | null;
  const jars = (jarsResult.data as JarRecord[] | null) ?? [];
  if (!family) throw new AllowanceError("That family doesn't exist.");
  if (family.keeper_role_id === null) throw new AllowanceError("Turn on automatic allowance first.");
  if (!treasury) throw new AllowanceError("The family wallet isn't set up yet.");
  if (!kid) throw new AllowanceError("That kid isn't in this family.");
  const jarAddress: Partial<Record<JarKind, string>> = Object.fromEntries(jars.map((j) => [j.kind, j.wallet_address]));
  if (JAR_KINDS.some((k) => !jarAddress[k])) throw new AllowanceError("This kid's wallets aren't ready.");

  const split = splitUnits(amountUnits, { spend: kid.spend_pct, save: kid.save_pct, share: kid.share_pct });

  const connection = getConnection();
  const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const mint = usdcMint();
  const treasuryOwner = new PublicKey(treasury.wallet_address);
  const fromAta = ataFor(treasury.wallet_address);

  const balance = await getAccount(connection, fromAta)
    .then((a) => a.amount)
    .catch(() => 0n);
  if (balance < amountUnits) {
    throw new AllowanceError(`The family wallet has ${unitsToDisplay(balance)} and this allowance is ${unitsToDisplay(amountUnits)}. Add test dollars, then try again.`);
  }

  const swig = await fetchSwig(connection, new PublicKey(treasury.swig_address));
  // The role id comes from the chain, not the stored one: the stored value only says the keeper was turned on.
  const roleId = keeperRoleOf(swig, feePayer.publicKey);
  if (roleId === null) throw new AllowanceError("The keeper role is missing on Solana. Turn on automatic allowance again.");

  const setup: TransactionInstruction[] = [];
  const transfers: TransactionInstruction[] = [];
  for (const kind of JAR_KINDS) {
    const amount = split[kind];
    if (amount === 0n) continue;
    const owner = new PublicKey(jarAddress[kind]!);
    const toAta = ataFor(jarAddress[kind]!);
    const exists = await getAccount(connection, toAta)
      .then(() => true)
      .catch(() => false);
    if (!exists) setup.push(createAssociatedTokenAccountIdempotentInstruction(feePayer.publicKey, toAta, owner, mint));
    transfers.push(createTransferInstruction(fromAta, toAta, treasuryOwner, amount, [], TOKEN_PROGRAM_ID));
  }
  const signed = await getSignInstructions(swig, roleId, transfers, false, { payer: feePayer.publicKey });
  // The fee payer is both the keeper authority and the payer: one signature covers both.
  const signature = await sendTx(connection, [...setup, ...signed], feePayer);
  return { signature, split };
}
