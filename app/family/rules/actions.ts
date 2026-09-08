"use server";

import { revalidatePath } from "next/cache";
import { Transaction } from "@solana/web3.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult, AddContactInput, ContactRuleView, MemberRulesView, PreparedRuleSync, RuleChange, RulesScreenProps, RuleSyncResult, SaveRulesResult } from "@/components/family/contract";
import { FIELD_LABELS } from "@/components/family/contract";
import { base64ToBytes, bytesToBase64 } from "@/lib/device/encoding";
import { buildRuleSyncTx } from "@/lib/family/onchain";
import { getFamilyContext } from "@/lib/family/session";
import { dollarsToUnits, toView, unitsToDisplay } from "@/lib/money/usdc";
import { getConnection } from "@/lib/solana/connection";
import { explorerUrl } from "@/lib/solana/explorer";
import { keypairFromEnv } from "@/lib/solana/keys";
import { issuePreparedToken, messageHashOf, verifyPreparedToken } from "@/lib/sponsor/prepared";
import { validateNewContact } from "@/lib/rules/contacts";
import { avatarEmoji, currentFamily, familyKids } from "@/lib/rules/family";
import {
  appliesAtLabel,
  applyLimitChange,
  defaultLimits,
  limitRowFromDb,
  limitRowToDb,
  resolvePending,
  type LimitField,
  type LimitRow,
  type LimitRowDb,
} from "@/lib/rules/limits";
import { createClient } from "@/lib/supabase/server";

type LimitDbRecord = LimitRowDb & { id: string; kid_id: string | null; onchain_synced: boolean };
type ContactRecord = { id: string; kid_id: string; label: string; avatar_id: string; weekly_limit_units: number; status: ContactRuleView["status"]; onchain_synced: boolean };

const ERR_NO_FAMILY = "Set up your family first.";

/** Everything the Rules screen renders, or null when the guardian has no family yet. */
export async function getRulesScreen(): Promise<RulesScreenProps | null> {
  if ((await getFamilyContext()).kind !== "guardian") return null;
  const supabase = await createClient();
  const family = await currentFamily(supabase);
  if (!family) return null;
  const now = new Date();

  const [kids, limitRecords, contactRecords, deviceRecords] = await Promise.all([
    familyKids(supabase, family.id),
    supabase.from("limits").select("id,kid_id,daily_limit_units,weekly_limit_units,approval_threshold_units,pending_raise,onchain_synced").eq("family_id", family.id),
    supabase.from("contacts").select("id,kid_id,label,avatar_id,weekly_limit_units,status,onchain_synced").eq("family_id", family.id).neq("status", "removed").order("created_at"),
    supabase.from("devices").select("kid_id").eq("family_id", family.id).eq("status", "active").not("kid_id", "is", null),
  ]);
  const limits = (limitRecords.data as LimitDbRecord[] | null) ?? [];
  const contacts = (contactRecords.data as ContactRecord[] | null) ?? [];
  const kidsWithDevice = new Set(((deviceRecords.data as Array<{ kid_id: string }> | null) ?? []).map((d) => d.kid_id));

  const memberView = async (kidId: string | null, kind: "kid" | "guardian", name: string, emoji: string): Promise<MemberRulesView> => {
    const record = limits.find((l) => l.kid_id === kidId) ?? null;
    let row = record ? limitRowFromDb(record) : defaultLimits(kind);
    if (record) {
      // A raise whose four hours have passed becomes the live value the first time anyone reads it.
      const resolved = resolvePending(row, now);
      if (resolved.changed) {
        await supabase.from("limits").update({ ...limitRowToDb(resolved.row), onchain_synced: false, updated_at: now.toISOString() }).eq("id", record.id);
      }
      row = resolved.row;
    }
    return {
      kidId,
      kind,
      name,
      emoji,
      dailyLimit: toView(row.daily_limit_units),
      weeklyLimit: kind === "kid" ? toView(row.weekly_limit_units) : null,
      approvalThreshold: kind === "kid" ? toView(row.approval_threshold_units) : null,
      pending: row.pending_raise
        ? { field: row.pending_raise.field, amount: toView(row.pending_raise.units), label: appliesAtLabel(row.pending_raise.effective_at, now, family.timezone) }
        : null,
      onchainSynced: record?.onchain_synced ?? false,
      hasDevice: kidId !== null && kidsWithDevice.has(kidId),
      contacts: contacts
        .filter((c) => kidId !== null && c.kid_id === kidId)
        .map((c) => ({ id: c.id, label: c.label, emoji: avatarEmoji(c.avatar_id), weeklyLimit: toView(BigInt(c.weekly_limit_units)), status: c.status, onchainSynced: c.onchain_synced })),
    };
  };

  const members: MemberRulesView[] = [];
  for (const kid of kids) members.push(await memberView(kid.id, "kid", kid.name, avatarEmoji(kid.avatar_id)));
  members.push(await memberView(null, "guardian", "Your wallet", "🛡️"));
  return { familyName: family.name, timezone: family.timezone, members };
}

/** Apply a batch of edits from the Rules screen. Every change is validated before any is written. */
export async function saveRuleChanges(changes: RuleChange[]): Promise<SaveRulesResult> {
  if ((await getFamilyContext()).kind !== "guardian") return { ok: false, error: "Only a guardian can change rules." };
  const supabase = await createClient();
  const family = await currentFamily(supabase);
  if (!family) return { ok: false, error: ERR_NO_FAMILY };
  if (changes.length === 0) return { ok: true, notices: [] };

  const parsed: Array<RuleChange & { units: bigint }> = [];
  for (const change of changes) {
    try {
      parsed.push({ ...change, units: dollarsToUnits(change.dollars) });
    } catch {
      const what = change.kind === "limit" ? FIELD_LABELS[change.field].toLowerCase() : "the weekly limit";
      return { ok: false, error: `Check the amount for ${what}: "${change.dollars}" isn't a dollar amount.` };
    }
  }

  const now = new Date();
  const notices: string[] = [];
  for (const change of parsed) {
    if (change.kind === "limit") {
      const kind = change.kidId === null ? "guardian" : "kid";
      if (kind === "guardian" && change.field !== "daily_limit_units") return { ok: false, error: "Only the daily limit applies to your own wallet." };
      const result = await writeLimit(supabase, family.id, change.kidId, kind, change.field, change.units, now);
      if (!result.ok) return result;
      if (result.pending) notices.push(`${FIELD_LABELS[change.field]} of ${unitsToDisplay(change.units)}: ${appliesAtLabel(result.pending, now, family.timezone)}`);
    } else {
      const { error } = await supabase
        .from("contacts")
        .update({ weekly_limit_units: Number(change.units), onchain_synced: false })
        .eq("id", change.contactId)
        .eq("family_id", family.id);
      if (error) return { ok: false, error: "That person's limit couldn't be saved. Try again." };
    }
  }
  revalidatePath("/family/rules");
  return { ok: true, notices };
}

async function writeLimit(
  supabase: SupabaseClient,
  familyId: string,
  kidId: string | null,
  kind: "kid" | "guardian",
  field: LimitField,
  units: bigint,
  now: Date,
): Promise<{ ok: true; pending: Date | null } | { ok: false; error: string }> {
  let query = supabase.from("limits").select("id,kid_id,daily_limit_units,weekly_limit_units,approval_threshold_units,pending_raise,onchain_synced").eq("family_id", familyId);
  query = kidId === null ? query.is("kid_id", null) : query.eq("kid_id", kidId);
  const { data } = await query.maybeSingle();
  const record = (data as LimitDbRecord | null) ?? null;

  const current: LimitRow = record ? resolvePending(limitRowFromDb(record), now).row : defaultLimits(kind);
  let next: LimitRow;
  try {
    next = applyLimitChange(current, field, units, now);
  } catch {
    return { ok: false, error: "Limits can't be negative." };
  }
  const payload = { ...limitRowToDb(next), onchain_synced: false, updated_at: now.toISOString() };
  const { error } = record
    ? await supabase.from("limits").update(payload).eq("id", record.id)
    : await supabase.from("limits").insert({ ...payload, family_id: familyId, kid_id: kidId });
  if (error) return { ok: false, error: "The limit couldn't be saved. Try again." };
  const pending = next.pending_raise?.field === field ? next.pending_raise.effective_at : null;
  return { ok: true, pending };
}

// --- Pushing rules on-chain. Same prepare / sign-on-device / submit shape as
// approving a device: the guardian's device key is root on the kid's wallets,
// so only it can rewrite the kid role. The fee payer co-signs the exact
// message it prepared and nothing else.

const ERR_NOT_GUARDIAN = "Only a guardian can update rules on-chain.";

/** Build the transaction that rewrites a kid's on-chain role from the current rules. */
export async function prepareRuleSync(kidId: string): Promise<PreparedRuleSync> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: ERR_NOT_GUARDIAN };
  const supabase = await createClient();
  const { data: kid } = await supabase.from("kids").select("id,name").eq("id", kidId).eq("family_id", ctx.familyId).maybeSingle();
  if (!kid) return { ok: false, error: "That kid isn't in your family." };
  const { data: myDevice } = await supabase.from("devices").select("pubkey").eq("user_id", ctx.userId).is("kid_id", null).eq("status", "active").maybeSingle();
  if (!myDevice) return { ok: false, error: "Set up this device on the wallet page first." };
  const { data: kidDevices } = await supabase.from("devices").select("pubkey").eq("kid_id", kidId).eq("status", "active").not("user_id", "is", null);
  const pubkeys = (kidDevices ?? []).map((d) => d.pubkey as string).filter((p) => !p.startsWith("pending:"));
  if (pubkeys.length === 0) return { ok: false, error: `${kid.name} has no paired device yet. Rules go on-chain when you approve one.` };
  const { data: wallets } = await supabase.from("wallets").select("kind,swig_address,wallet_address").eq("kid_id", kidId);
  const byKind = Object.fromEntries((wallets ?? []).map((w) => [w.kind, { swigAddress: w.swig_address, walletAddress: w.wallet_address }])) as Record<"spend" | "save" | "share", { swigAddress: string; walletAddress: string }>;
  if (!byKind.spend || !byKind.save || !byKind.share) return { ok: false, error: "This kid's wallets aren't ready." };

  const now = new Date();
  const { data: limitData } = await supabase.from("limits").select("id,kid_id,daily_limit_units,weekly_limit_units,approval_threshold_units,pending_raise,onchain_synced").eq("kid_id", kidId).maybeSingle();
  const limitRecord = (limitData as LimitDbRecord | null) ?? null;
  // Only the live value goes on-chain; a raise still inside its four hours stays off until it resolves.
  const live = limitRecord ? resolvePending(limitRowFromDb(limitRecord), now).row : defaultLimits("kid");
  const { data: contacts } = await supabase.from("contacts").select("address,weekly_limit_units").eq("kid_id", kidId).eq("status", "active");

  let tx: Transaction;
  try {
    ({ tx } = await buildRuleSyncTx({
      guardianDevicePubkey: myDevice.pubkey,
      kidDevicePubkeys: pubkeys,
      wallets: byKind,
      contacts: (contacts ?? []).map((c) => ({ address: c.address, weeklyUnits: BigInt(c.weekly_limit_units) })),
      dailyLimitUnits: live.daily_limit_units,
    }));
  } catch {
    return { ok: false, error: "Couldn't read the wallets on Solana just now. Try again in a moment." };
  }
  const token = await issuePreparedToken({ userId: ctx.userId, messageHash: messageHashOf(tx), purpose: "rule_update" });
  return {
    ok: true,
    token,
    txBase64: bytesToBase64(new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }))),
    summary: `Update ${kid.name}'s rules on-chain: ${(contacts ?? []).length} people on the list, ${unitsToDisplay(live.daily_limit_units)} a day`,
  };
}

/** Co-sign and send the transaction the guardian's device signed, then mark the rules as live. */
export async function submitRuleSync(input: { kidId: string; token: string; signedTxBase64: string }): Promise<RuleSyncResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: ERR_NOT_GUARDIAN };
  const claims = await verifyPreparedToken(input.token);
  if (!claims || claims.userId !== ctx.userId || claims.purpose !== "rule_update") return { ok: false, error: "That took too long. Try the update again." };
  const tx = Transaction.from(base64ToBytes(input.signedTxBase64));
  if (messageHashOf(tx) !== claims.messageHash) return { ok: false, error: "This isn't the transaction we prepared." };

  const supabase = await createClient();
  const { data: kid } = await supabase.from("kids").select("id").eq("id", input.kidId).eq("family_id", ctx.familyId).maybeSingle();
  if (!kid) return { ok: false, error: "That kid isn't in your family." };

  const connection = getConnection();
  let signature: string;
  try {
    tx.partialSign(keypairFromEnv("FEE_PAYER_SECRET_KEY"));
    signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature, ...(await connection.getLatestBlockhash("confirmed")) }, "confirmed");
  } catch {
    return { ok: false, error: "Solana didn't accept the update. The old rules are still in force; try again." };
  }

  await supabase.from("limits").update({ onchain_synced: true }).eq("kid_id", input.kidId);
  await supabase.from("contacts").update({ onchain_synced: true }).eq("kid_id", input.kidId).eq("status", "active");
  revalidatePath("/family/rules");
  return { ok: true, explorerUrl: explorerUrl(signature, "tx") };
}

// --- The list itself. Guardians add and remove people; both leave the
// contact "Updating" until the on-chain panel pushes the new role.

const ERR_NOT_GUARDIAN_LIST = "Only a guardian can change who's on the list.";

/** Put someone on a kid's list. A removed contact at the same address comes back instead of duplicating. */
export async function addContact(input: AddContactInput): Promise<ActionResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: ERR_NOT_GUARDIAN_LIST };
  const check = validateNewContact(input);
  if (!check.ok) return check;
  const supabase = await createClient();
  const { data: kid } = await supabase.from("kids").select("id,name").eq("id", input.kidId).eq("family_id", ctx.familyId).maybeSingle();
  if (!kid) return { ok: false, error: "That kid isn't in your family." };

  const { contact } = check;
  const { data: existing } = await supabase.from("contacts").select("id,status").eq("kid_id", kid.id).eq("address", contact.address).maybeSingle();
  if (existing && existing.status !== "removed") return { ok: false, error: `That address is already on ${kid.name}'s list.` };

  const row = { label: contact.label, avatar_id: contact.avatarId, weekly_limit_units: Number(contact.weeklyUnits), status: "active", onchain_synced: false };
  const { error } = existing
    ? await supabase.from("contacts").update(row).eq("id", existing.id).eq("family_id", ctx.familyId)
    : await supabase.from("contacts").insert({ family_id: ctx.familyId, kid_id: kid.id, address: contact.address, ...row });
  if (error) return { ok: false, error: "Couldn't add them. Try again." };
  revalidatePath("/family/rules");
  return { ok: true };
}

/** Take someone off a kid's list. The row stays (history), the on-chain role drops them at the next update. */
export async function removeContact(contactId: string): Promise<ActionResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: ERR_NOT_GUARDIAN_LIST };
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ status: "removed", onchain_synced: false }).eq("id", contactId).eq("family_id", ctx.familyId);
  if (error) return { ok: false, error: "Couldn't remove them. Try again." };
  revalidatePath("/family/rules");
  return { ok: true };
}
