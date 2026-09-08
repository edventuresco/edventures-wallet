// The keeper: a limited role on the family treasury held by the server's fee
// payer key, so allowances can go out on a schedule without the guardian's
// device. Its only permission is a weekly USDC cap. There is no destination
// list, so adding a kid never sends the guardian back to sign. Server-only.

import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Actions, createEd25519AuthorityInfo, fetchSwig, getAddAuthorityInstructions, type Swig } from "@swig-wallet/classic";
import { getConnection } from "@/lib/solana/connection";
import { keypairFromEnv } from "@/lib/solana/keys";
import { usdcMint } from "@/lib/solana/mint";
import { roleIdFor, roleIdOrNull } from "@/lib/swig/wallet";
import { spendWindowSlots, WEEK_MS } from "@/lib/swig/windows";
import { DEFAULTS } from "./defaults";
import { slotMs } from "./onchain";

/** Pure: what the keeper may do. One general recurring cap on the mint, nothing else. */
export function keeperActions(input: { mint: PublicKey; weeklyUnits: bigint; windowSlots: bigint }): Actions {
  if (input.weeklyUnits <= 0n) throw new Error(`keeperActions: weeklyUnits must be positive (got ${input.weeklyUnits})`);
  if (input.windowSlots <= 0n) throw new Error(`keeperActions: windowSlots must be positive (got ${input.windowSlots})`);
  return Actions.set().tokenRecurringLimit({ mint: input.mint, recurringAmount: input.weeklyUnits, window: input.windowSlots }).get();
}

/** The keeper's role id on a wallet, or null when that authority holds no role there. */
export function keeperRoleOf(swig: Swig, authority: PublicKey): number | null {
  return roleIdOrNull(swig, authority);
}

/**
 * One transaction that adds the fee payer as the keeper role on the family
 * treasury. The guardian's device signs as root; the fee payer pays (and, as
 * the new authority, needs no signature of its own for the add).
 */
export async function buildKeeperRoleTx(input: { guardianDevicePubkey: string; familySwigAddress: string }): Promise<{ tx: Transaction; feePayer: Keypair }> {
  const connection = getConnection();
  const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const swig = await fetchSwig(connection, new PublicKey(input.familySwigAddress));
  if (keeperRoleOf(swig, feePayer.publicKey) !== null) throw new Error("buildKeeperRoleTx: the keeper already holds a role on this wallet");
  const rootRoleId = roleIdFor(swig, new PublicKey(input.guardianDevicePubkey));
  const actions = keeperActions({ mint: usdcMint(), weeklyUnits: DEFAULTS.keeperWeeklyUnits, windowSlots: spendWindowSlots(WEEK_MS, await slotMs()) });
  const ixs = await getAddAuthorityInstructions(swig, rootRoleId, createEd25519AuthorityInfo(feePayer.publicKey), actions, { payer: feePayer.publicKey });

  const tx = new Transaction().add(...ixs);
  tx.feePayer = feePayer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  return { tx, feePayer };
}

/** After the add lands (or to check): the keeper's role id on the family treasury, or null. */
export async function readKeeperRoleId(familySwigAddress: string): Promise<number | null> {
  const swig = await fetchSwig(getConnection(), new PublicKey(familySwigAddress));
  return keeperRoleOf(swig, keypairFromEnv("FEE_PAYER_SECRET_KEY").publicKey);
}
