"use server";

import { revalidatePath } from "next/cache";
import { Transaction } from "@solana/web3.js";
import type { ActionResult, AllowanceScreenProps, KeeperRoleResult, KidAllowanceView, PreparedKeeperRole } from "@/components/family/contract";
import { getFamilyContext } from "@/lib/family/session";
import { allowanceEventRows } from "@/lib/allowance/events";
import { AllowanceError, sendAllowanceOnChain, type AllowanceReceipt } from "@/lib/allowance/keeper";
import { base64ToBytes, bytesToBase64 } from "@/lib/device/encoding";
import { DEFAULTS } from "@/lib/family/defaults";
import { buildKeeperRoleTx, readKeeperRoleId } from "@/lib/family/keeper";
import { dollarsToUnits, toView, unitsToDisplay } from "@/lib/money/usdc";
import { ageFromBirth, defaultAllowanceUnits, nextMondayAt } from "@/lib/rules/allowance";
import { avatarEmoji, currentFamily, dateTimeLabel, familyKids, type KidRow } from "@/lib/rules/family";
import { getConnection } from "@/lib/solana/connection";
import { explorerUrl } from "@/lib/solana/explorer";
import { keypairFromEnv } from "@/lib/solana/keys";
import { issuePreparedToken, messageHashOf, verifyPreparedToken } from "@/lib/sponsor/prepared";
import { createClient } from "@/lib/supabase/server";

type AllowanceRecord = { id: string; kid_id: string; amount_units: number; next_run_at: string; last_paid_at: string | null };
type KeeperRecord = { keeper_role_id: number | null };

const ERR_NO_FAMILY = "Set up your family first.";
const ERR_NO_KID = "That kid isn't in your family.";
const ERR_NOT_GUARDIAN = "Only a guardian can turn on automatic allowance.";

/** Everything the Allowance screen renders, or null when the guardian has no family yet. */
export async function getAllowanceScreen(): Promise<AllowanceScreenProps | null> {
  if ((await getFamilyContext()).kind !== "guardian") return null;
  const supabase = await createClient();
  const family = await currentFamily(supabase);
  if (!family) return null;
  const now = new Date();

  const [kids, records, keeper] = await Promise.all([
    familyKids(supabase, family.id),
    supabase.from("allowances").select("id,kid_id,amount_units,next_run_at,last_paid_at").eq("family_id", family.id),
    supabase.from("families").select("keeper_role_id").eq("id", family.id).maybeSingle(),
  ]);
  const allowances = (records.data as AllowanceRecord[] | null) ?? [];
  const keeperEnabled = (keeper.data as KeeperRecord | null)?.keeper_role_id != null;

  const view = (kid: KidRow): KidAllowanceView => {
    const record = allowances.find((a) => a.kid_id === kid.id) ?? null;
    const age = ageFromBirth(kid.birth_month, kid.birth_year, now);
    const units = record ? BigInt(record.amount_units) : defaultAllowanceUnits(age);
    const nextRun = record ? new Date(record.next_run_at) : nextMondayAt(now, family.timezone);
    return {
      id: kid.id,
      name: kid.name,
      emoji: avatarEmoji(kid.avatar_id),
      age,
      amount: toView(units),
      isDefault: record === null,
      cadence: "weekly",
      nextRunISO: nextRun.toISOString(),
      nextRunLabel: dateTimeLabel(nextRun, family.timezone),
      lastPaidLabel: record?.last_paid_at ? dateTimeLabel(new Date(record.last_paid_at), family.timezone) : null,
    };
  };
  return { familyName: family.name, timezone: family.timezone, kids: kids.map(view), keeperEnabled, keeperWeeklyCap: toView(DEFAULTS.keeperWeeklyUnits) };
}

/** Set a kid's weekly allowance. The next payment is the coming Monday 09:00 family time. */
export async function saveAllowance(kidId: string, dollars: string): Promise<ActionResult> {
  if ((await getFamilyContext()).kind !== "guardian") return { ok: false, error: "Only a guardian can set an allowance." };
  const supabase = await createClient();
  const family = await currentFamily(supabase);
  if (!family) return { ok: false, error: ERR_NO_FAMILY };
  let units: bigint;
  try {
    units = dollarsToUnits(dollars);
  } catch {
    return { ok: false, error: `"${dollars}" isn't a dollar amount.` };
  }
  if (units <= 0n) return { ok: false, error: "An allowance needs to be above zero." };
  const kids = await familyKids(supabase, family.id);
  if (!kids.some((k) => k.id === kidId)) return { ok: false, error: ERR_NO_KID };

  const now = new Date();
  const { error } = await supabase.from("allowances").upsert(
    { family_id: family.id, kid_id: kidId, amount_units: Number(units), cadence: "weekly", next_run_at: nextMondayAt(now, family.timezone).toISOString(), updated_at: now.toISOString() },
    { onConflict: "kid_id" },
  );
  if (error) return { ok: false, error: "The allowance couldn't be saved. Try again." };
  revalidatePath("/family/allowance");
  return { ok: true };
}

/**
 * Pay this week's allowance right now. The keeper role moves it from the
 * family wallet into the kid's jars in one transaction (lib/allowance/keeper.ts).
 */
export async function payAllowanceNow(kidId: string): Promise<ActionResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can pay an allowance." };
  const user = { id: ctx.userId };
  const supabase = await createClient();
  const family = await currentFamily(supabase);
  if (!family) return { ok: false, error: ERR_NO_FAMILY };
  const kid = (await familyKids(supabase, family.id)).find((k) => k.id === kidId);
  if (!kid) return { ok: false, error: ERR_NO_KID };
  const now = new Date();

  const { data } = await supabase.from("allowances").select("id,kid_id,amount_units,next_run_at,last_paid_at").eq("kid_id", kidId).maybeSingle();
  const record = (data as AllowanceRecord | null) ?? null;
  const units = record ? BigInt(record.amount_units) : defaultAllowanceUnits(ageFromBirth(kid.birth_month, kid.birth_year, now));

  let receipt: AllowanceReceipt;
  try {
    receipt = await sendAllowanceOnChain({ familyId: family.id, kidId, amountUnits: units });
  } catch (error) {
    if (error instanceof AllowanceError) return { ok: false, error: error.message };
    return { ok: false, error: `The allowance to ${kid.name} didn't go through on Solana. Check the family wallet before trying again.` };
  }

  const { data: wallet } = await supabase.from("wallets").select("id").eq("kid_id", kidId).eq("kind", "spend").maybeSingle();
  const { error } = await supabase
    .from("events")
    .insert(allowanceEventRows({ userId: user.id, familyId: family.id, kidId, walletId: (wallet as { id: string } | null)?.id ?? null, amountUnits: units, receipt }));
  if (error) return { ok: false, error: "The payment went through but couldn't be recorded. Refresh before paying again." };

  // Paying now does not move the Monday schedule; it only records when the kid was last paid.
  await supabase.from("allowances").upsert(
    {
      family_id: family.id,
      kid_id: kidId,
      amount_units: Number(units),
      cadence: "weekly",
      next_run_at: record?.next_run_at ?? nextMondayAt(now, family.timezone).toISOString(),
      last_paid_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "kid_id" },
  );
  revalidatePath("/family/allowance");
  return { ok: true };
}

// --- Turning the keeper on. Same prepare / sign-on-device / submit shape as
// approving a device: the guardian's device key is root on the family wallet,
// so only it can add the keeper role. The fee payer co-signs the exact message
// it prepared and nothing else.

/** Build the transaction that adds the keeper role (the server's fee payer, capped weekly) to the family wallet. */
export async function prepareKeeperRole(): Promise<PreparedKeeperRole> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: ERR_NOT_GUARDIAN };
  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("keeper_role_id").eq("id", ctx.familyId).maybeSingle();
  if ((family as KeeperRecord | null)?.keeper_role_id != null) return { ok: false, error: "Automatic allowance is already on." };
  const { data: myDevice } = await supabase.from("devices").select("id,pubkey").eq("user_id", ctx.userId).is("kid_id", null).eq("status", "active").maybeSingle();
  if (!myDevice) return { ok: false, error: "Set up this device on the wallet page first." };
  const { data: treasury } = await supabase.from("wallets").select("swig_address,root_device_id").eq("family_id", ctx.familyId).eq("kind", "family").maybeSingle();
  if (!treasury) return { ok: false, error: "Create your own wallet first; it becomes the family wallet." };
  if (treasury.root_device_id !== myDevice.id) return { ok: false, error: "The family wallet was created on another device. Turn on automatic allowance from that device." };

  let tx: Transaction;
  try {
    // A role that is already on-chain (a submit that landed but was not saved) is saved now rather than added twice.
    const existing = await readKeeperRoleId(treasury.swig_address);
    if (existing !== null) {
      await supabase.from("families").update({ keeper_role_id: existing }).eq("id", ctx.familyId);
      revalidatePath("/family/allowance");
      return { ok: false, error: "Automatic allowance is already on." };
    }
    ({ tx } = await buildKeeperRoleTx({ guardianDevicePubkey: myDevice.pubkey, familySwigAddress: treasury.swig_address }));
  } catch {
    return { ok: false, error: "Couldn't read the family wallet on Solana just now. Try again in a moment." };
  }
  const token = await issuePreparedToken({ userId: ctx.userId, messageHash: messageHashOf(tx), purpose: "allowance" });
  return {
    ok: true,
    token,
    txBase64: bytesToBase64(new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }))),
    summary: `Let Edventures Wallet pay allowances from the family wallet, up to ${unitsToDisplay(DEFAULTS.keeperWeeklyUnits)} a week`,
  };
}

/** Co-sign and send the transaction the guardian's device signed, then remember the keeper's role id. */
export async function submitKeeperRole(input: { token: string; signedTxBase64: string }): Promise<KeeperRoleResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: ERR_NOT_GUARDIAN };
  const claims = await verifyPreparedToken(input.token);
  if (!claims || claims.userId !== ctx.userId || claims.purpose !== "allowance") return { ok: false, error: "That took too long. Try again." };
  const tx = Transaction.from(base64ToBytes(input.signedTxBase64));
  if (messageHashOf(tx) !== claims.messageHash) return { ok: false, error: "This isn't the transaction we prepared." };

  const supabase = await createClient();
  const { data: treasury } = await supabase.from("wallets").select("swig_address").eq("family_id", ctx.familyId).eq("kind", "family").maybeSingle();
  if (!treasury) return { ok: false, error: "Create your own wallet first; it becomes the family wallet." };

  const connection = getConnection();
  let signature: string;
  try {
    tx.partialSign(keypairFromEnv("FEE_PAYER_SECRET_KEY"));
    signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature, ...(await connection.getLatestBlockhash("confirmed")) }, "confirmed");
  } catch {
    return { ok: false, error: "Solana didn't accept the keeper role. Nothing changed; try again." };
  }

  const roleId = await readKeeperRoleId(treasury.swig_address);
  if (roleId === null) return { ok: false, error: "The role went on-chain but couldn't be read back yet. Refresh and try again." };
  const { error } = await supabase.from("families").update({ keeper_role_id: roleId }).eq("id", ctx.familyId);
  if (error) return { ok: false, error: "The role is live on Solana but couldn't be saved. Refresh and try again." };
  revalidatePath("/family/allowance");
  return { ok: true, explorerUrl: explorerUrl(signature, "tx") };
}
