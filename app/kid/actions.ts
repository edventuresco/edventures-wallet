"use server";

// The kid's Send: the rules decide, the kid's device signs in the browser,
// the fee payer co-signs only the exact message it prepared. Same
// prepare / sign-on-device / submit seam as approving a device.

import { PublicKey, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferInstruction, getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fetchSwig, getSignInstructions } from "@swig-wallet/classic";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendContact } from "@/components/kid/send/ContactGrid";
import { base64ToBytes, bytesToBase64 } from "@/lib/device/encoding";
import { DEFAULTS } from "@/lib/family/defaults";
import { checkJarBalance, jarMoveSummary, validateJarMove, type JarMoveInput, type JarMoveKind } from "@/lib/family/jar-move";
import { ataFor } from "@/lib/family/onchain";
import { checkShareBalance, checkShareContact, findApprovedShare, shareSummary, validateShareAmount, type ShareRequestRow } from "@/lib/family/share";
import { getFamilyContext, type FamilyContext } from "@/lib/family/session";
import { dailyLeftUnits, decideSend, leftUnits, startOfDay, startOfWeek, sumSentSince, type ApprovedSend, type SentEventRow } from "@/lib/kid/rules";
import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";
import { defaultLimits, limitRowFromDb, resolvePending, type LimitRow, type LimitRowDb } from "@/lib/rules/limits";
import { getConnection } from "@/lib/solana/connection";
import { explorerUrl } from "@/lib/solana/explorer";
import { keypairFromEnv } from "@/lib/solana/keys";
import { usdcMint } from "@/lib/solana/mint";
import { TxError } from "@/lib/solana/tx";
import { countSponsoredToday, SPONSORED_PER_DAY } from "@/lib/sponsor/policy";
import { issuePreparedToken, messageHashOf, verifyPreparedToken } from "@/lib/sponsor/prepared";
import { reasonFor } from "@/lib/sponsor/reasons";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { roleIdFor } from "@/lib/swig/wallet";

type KidContext = Extract<FamilyContext, { kind: "kid" }>;

/** A guardian's yes the kid has not used yet. `dollars` is bare, e.g. "22.00". */
export type ApprovedSendView = { requestId: string; contactId: string; dollars: string; label: string; amountDisplay: string };

export type KidSendContext =
  | {
      ok: true;
      contacts: SendContact[];
      /** USDC base units as a decimal string; bigint cannot cross to the client. */
      dailyLeftUnits: string;
      /** How the kid refers to their guardian, e.g. "Mum". */
      parentName: string;
      approvedSend: ApprovedSendView | null;
    }
  | { ok: false; error: string };

export type PreparedKidSend = { ok: true; token: string; txBase64: string } | { ok: false; message: string; needsApproval?: boolean };
export type KidSendResult = { ok: true; explorerUrl: string } | { ok: false; message: string };

type ContactRecord = { id: string; label: string; avatar_id: string; address: string; weekly_limit_units: number; status: "active" | "requested" | "removed" };
type RequestPayload = { contactId?: string; dollars?: string; label?: string } | null;
type RequestRecord = { id: string; payload: RequestPayload; decided_at: string | null };
type SpendWallet = { id: string; swig_address: string; wallet_address: string };

const NOT_A_KID: Record<Exclude<FamilyContext["kind"], "kid">, string> = {
  signed_out: "Sign in on your device first.",
  guardian: "This is the kid side. Send from your family wallet instead.",
  none: "This device isn't set up yet. Ask a parent to invite you.",
};
const ERR_AMOUNT = "That amount doesn't look right. Try typing it again.";
const ERR_NOT_ON_LIST = "That person isn't on your list yet. Ask a parent to add them.";
const ERR_NO_WALLET = "Your wallet isn't ready yet. Ask a parent to check it.";
const ERR_CAP = "You've done a lot today. More tomorrow.";
const ERR_CHAIN = "Couldn't reach Solana just now. Nothing was sent. Try again in a moment.";
const ERR_TOKEN = "That took too long. Try the send again.";
const ERR_NOT_PREPARED = "This isn't the transaction we prepared.";

/** "$22.00" -> "22.00": what goes in a request payload, parsed back by dollarsToUnits. */
const bareDollars = (units: bigint) => unitsToDisplay(units).replace(/[$,]/g, "");

function sameUnits(dollars: string | undefined, units: bigint): boolean {
  try {
    return dollars !== undefined && dollarsToUnits(dollars) === units;
  } catch {
    return false;
  }
}

type KidRules = {
  now: Date;
  timeZone: string;
  weekStart: Date;
  limits: LimitRow;
  contacts: ContactRecord[];
  /** This week's `sent` events for the kid; today's are a subset. */
  events: SentEventRow[];
  spend: SpendWallet | null;
  parentName: string;
  approved: (ApprovedSend & { requestId: string; dollars: string; label: string }) | null;
};

/** Everything the rules need for this kid, in one round of reads scoped by RLS. */
async function loadKid(supabase: SupabaseClient, ctx: KidContext): Promise<KidRules> {
  const now = new Date();
  const { data: family } = await supabase.from("families").select("timezone").eq("id", ctx.familyId).maybeSingle();
  const timeZone = (family?.timezone as string | undefined) ?? DEFAULTS.timezone;
  const weekStart = startOfWeek(now, timeZone);
  const dayStart = startOfDay(now, timeZone);

  const [limitRes, contactRes, eventRes, spendRes, guardianRes, requestRes] = await Promise.all([
    supabase.from("limits").select("daily_limit_units,weekly_limit_units,approval_threshold_units,pending_raise").eq("kid_id", ctx.kidId).maybeSingle(),
    supabase.from("contacts").select("id,label,avatar_id,address,weekly_limit_units,status").eq("kid_id", ctx.kidId).order("created_at"),
    supabase.from("events").select("kind,amount_units,created_at,counterparty").eq("kid_id", ctx.kidId).eq("kind", "sent").gte("created_at", weekStart.toISOString()),
    supabase.from("wallets").select("id,swig_address,wallet_address").eq("kid_id", ctx.kidId).eq("kind", "spend").maybeSingle(),
    supabase.from("guardians").select("label").eq("family_id", ctx.familyId).limit(1).maybeSingle(),
    supabase
      .from("requests")
      .select("id,payload,decided_at")
      .eq("kid_id", ctx.kidId)
      .eq("type", "approve_send")
      .eq("status", "approved")
      .gte("decided_at", dayStart.toISOString())
      .order("decided_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Only the live value counts; a raise still inside its four hours stays off.
  // Reading never writes the row back: that is the guardian's Rules screen.
  const limitRow = limitRes.data as LimitRowDb | null;
  const limits = limitRow ? resolvePending(limitRowFromDb(limitRow), now).row : defaultLimits("kid");
  const contacts = (contactRes.data as ContactRecord[] | null) ?? [];
  const parentContact = contacts.find((c) => c.avatar_id === "parent");
  const parentName = parentContact?.label ?? (guardianRes.data?.label === "Guardian" ? "Guardian" : "Mum");

  return {
    now,
    timeZone,
    weekStart,
    limits,
    contacts,
    events: (eventRes.data as SentEventRow[] | null) ?? [],
    spend: (spendRes.data as SpendWallet | null) ?? null,
    parentName,
    approved: approvedFrom(requestRes.data as RequestRecord | null),
  };
}

function approvedFrom(r: RequestRecord | null): KidRules["approved"] {
  const p = r?.payload;
  if (!r || !p?.contactId || !p.dollars || !r.decided_at) return null;
  try {
    return { requestId: r.id, contactId: p.contactId, dollars: p.dollars, label: p.label ?? "", units: dollarsToUnits(p.dollars), decidedAt: new Date(r.decided_at) };
  } catch {
    return null;
  }
}

async function recordBlocked(supabase: SupabaseClient, ctx: KidContext, e: { walletId: string | null; units: bigint; counterparty: string | null; reason: string; message: string }) {
  await supabase.from("events").insert({
    user_id: ctx.userId,
    family_id: ctx.familyId,
    kid_id: ctx.kidId,
    wallet_id: e.walletId,
    kind: "blocked",
    amount_units: Number(e.units),
    counterparty: e.counterparty,
    reason: e.reason,
    summary: e.message,
  });
}

/** One pending ask per person and amount; tapping Send twice does not nag the guardian twice. */
async function askForApproval(supabase: SupabaseClient, ctx: KidContext, contact: ContactRecord, units: bigint) {
  const { data: pending } = await supabase.from("requests").select("id,payload").eq("kid_id", ctx.kidId).eq("type", "approve_send").eq("status", "pending");
  const already = ((pending as Array<{ payload: RequestPayload }> | null) ?? []).some((r) => r.payload?.contactId === contact.id && sameUnits(r.payload?.dollars, units));
  if (already) return;
  await supabase.from("requests").insert({
    family_id: ctx.familyId,
    kid_id: ctx.kidId,
    type: "approve_send",
    payload: { contactId: contact.id, dollars: bareDollars(units), label: contact.label },
  });
}

/** After a send lands, the guardian's yes that covered it is spent. */
async function consumeApproval(supabase: SupabaseClient, ctx: KidContext, k: KidRules, sel: { requestId?: string; contactId: string; units: bigint }) {
  const { data } = await supabase
    .from("requests")
    .select("id,payload")
    .eq("kid_id", ctx.kidId)
    .eq("type", "approve_send")
    .eq("status", "approved")
    .gte("decided_at", startOfDay(k.now, k.timeZone).toISOString());
  const rows = (data as Array<{ id: string; payload: RequestPayload }> | null) ?? [];
  const covers = (r: { payload: RequestPayload }) => r.payload?.contactId === sel.contactId && sameUnits(r.payload?.dollars, sel.units);
  const match = rows.find((r) => r.id === sel.requestId && covers(r)) ?? rows.find(covers);
  if (!match) return;
  // RLS lets only guardians update requests today; the kid's own "used" mark
  // goes through the service role until migration 20260907070000 is applied.
  const writer = getSupabaseAdmin() ?? supabase;
  await writer.from("requests").update({ status: "used" }).eq("id", match.id).eq("kid_id", ctx.kidId).eq("status", "approved");
}

/** What the kid's Send screen needs, for the signed-in kid device. */
export async function getKidSendContext(): Promise<KidSendContext> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, error: NOT_A_KID[ctx.kind] };
  const supabase = await createClient();
  const k = await loadKid(supabase, ctx);
  const active = k.contacts.filter((c) => c.status === "active");
  const sentToday = sumSentSince(k.events, startOfDay(k.now, k.timeZone));
  const approvedContact = k.approved ? active.find((c) => c.id === k.approved?.contactId) : undefined;
  return {
    ok: true,
    contacts: active.map((c) => ({
      id: c.id,
      label: c.label,
      avatarId: c.avatar_id,
      weeklyLeftDisplay: `${unitsToDisplay(leftUnits(BigInt(c.weekly_limit_units), sumSentSince(k.events, k.weekStart, c.address)))} left this week`,
    })),
    dailyLeftUnits: dailyLeftUnits(k.limits.daily_limit_units, sentToday).toString(),
    parentName: k.parentName,
    approvedSend:
      k.approved && approvedContact
        ? { requestId: k.approved.requestId, contactId: approvedContact.id, dollars: k.approved.dollars, label: approvedContact.label, amountDisplay: unitsToDisplay(k.approved.units) }
        : null,
  };
}

/**
 * Decide, then build. Blocked sends are written to `events` with the reason;
 * sends over the threshold become a request for the guardian; the rest come
 * back as a transaction for the kid's device to sign.
 */
export async function prepareKidSend(input: { contactId: string; dollars: string }): Promise<PreparedKidSend> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, message: NOT_A_KID[ctx.kind] };
  let units: bigint;
  try {
    units = dollarsToUnits(input.dollars);
  } catch {
    return { ok: false, message: ERR_AMOUNT };
  }
  const supabase = await createClient();
  const k = await loadKid(supabase, ctx);
  const contact = k.contacts.find((c) => c.id === input.contactId) ?? null;

  const decision = decideSend({
    units,
    contact: contact ? { id: contact.id, label: contact.label, status: contact.status } : null,
    dailyLimitUnits: k.limits.daily_limit_units,
    sentTodayUnits: sumSentSince(k.events, startOfDay(k.now, k.timeZone)),
    weeklyLimitUnits: k.limits.weekly_limit_units,
    sentThisWeekUnits: sumSentSince(k.events, k.weekStart),
    contactWeeklyUnits: contact ? BigInt(contact.weekly_limit_units) : 0n,
    contactSentThisWeekUnits: contact ? sumSentSince(k.events, k.weekStart, contact.address) : 0n,
    approvalThresholdUnits: k.limits.approval_threshold_units,
    approvedRequest: k.approved,
    now: k.now,
    timeZone: k.timeZone,
  });

  if (decision.kind === "blocked") {
    await recordBlocked(supabase, ctx, { walletId: k.spend?.id ?? null, units, counterparty: contact?.address ?? null, reason: decision.reason, message: decision.message });
    return { ok: false, message: decision.message };
  }
  // decideSend already stopped a missing contact; this keeps the types honest.
  if (!contact) return { ok: false, message: ERR_NOT_ON_LIST };
  if (decision.kind === "needs_approval") {
    await askForApproval(supabase, ctx, contact, units);
    return { ok: false, needsApproval: true, message: `This one needs a parent. We asked ${k.parentName}.` };
  }

  if (!k.spend) return { ok: false, message: ERR_NO_WALLET };
  if ((await countSponsoredToday(supabase, ctx.userId, k.timeZone)) >= SPONSORED_PER_DAY) return { ok: false, message: ERR_CAP };
  const { data: device } = await supabase.from("devices").select("pubkey,role_id").eq("id", ctx.deviceId).maybeSingle();
  if (!device) return { ok: false, message: NOT_A_KID.none };
  let to: PublicKey;
  try {
    to = new PublicKey(contact.address);
  } catch {
    return { ok: false, message: `${contact.label}'s wallet address doesn't look right. Ask ${k.parentName} to check it.` };
  }

  try {
    const connection = getConnection();
    const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
    const mint = usdcMint();
    const owner = new PublicKey(k.spend.wallet_address);
    const fromAta = getAssociatedTokenAddressSync(mint, owner, true);
    const toAta = getAssociatedTokenAddressSync(mint, to, true);
    // The recipient's token account is created inside the same verified, capped
    // transaction, never as a side effect of preparing one.
    const toAtaExists = await getAccount(connection, toAta).then(() => true).catch(() => false);
    const swig = await fetchSwig(connection, new PublicKey(k.spend.swig_address));
    let roleId = device.role_id as number | null;
    if (roleId == null) {
      try {
        roleId = roleIdFor(swig, new PublicKey(device.pubkey));
      } catch {
        return { ok: false, message: `This device isn't on your wallet yet. Ask ${k.parentName} to approve it.` };
      }
    }
    const transfer = createTransferInstruction(fromAta, toAta, owner, units, [], TOKEN_PROGRAM_ID);
    const ixs = await getSignInstructions(swig, roleId, [transfer], false, { payer: feePayer.publicKey });

    const tx = new Transaction();
    if (!toAtaExists) tx.add(createAssociatedTokenAccountIdempotentInstruction(feePayer.publicKey, toAta, to, mint));
    tx.add(...ixs);
    tx.feePayer = feePayer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    const token = await issuePreparedToken({ userId: ctx.userId, messageHash: messageHashOf(tx), purpose: "transfer" });
    return { ok: true, token, txBase64: bytesToBase64(new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }))) };
  } catch {
    return { ok: false, message: ERR_CHAIN };
  }
}

/** Co-sign and send what the kid's device signed, then write down what happened. */
export async function submitKidSend(input: { token: string; signedTxBase64: string; contactId: string; dollars: string; requestId?: string }): Promise<KidSendResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, message: NOT_A_KID[ctx.kind] };
  const claims = await verifyPreparedToken(input.token);
  if (!claims || claims.userId !== ctx.userId || claims.purpose !== "transfer") return { ok: false, message: ERR_TOKEN };
  let tx: Transaction;
  try {
    tx = Transaction.from(base64ToBytes(input.signedTxBase64));
  } catch {
    return { ok: false, message: ERR_NOT_PREPARED };
  }
  // The fee payer co-signs only the exact message it prepared.
  if (messageHashOf(tx) !== claims.messageHash) return { ok: false, message: ERR_NOT_PREPARED };
  let units: bigint;
  try {
    units = dollarsToUnits(input.dollars);
  } catch {
    return { ok: false, message: ERR_AMOUNT };
  }

  const supabase = await createClient();
  const k = await loadKid(supabase, ctx);
  const contact = k.contacts.find((c) => c.id === input.contactId);
  if (!contact) return { ok: false, message: ERR_NOT_ON_LIST };
  if (!k.spend) return { ok: false, message: ERR_NO_WALLET };
  // The cap is enforced where the fee payer actually signs, not only at prepare time.
  if ((await countSponsoredToday(supabase, ctx.userId, k.timeZone)) >= SPONSORED_PER_DAY) return { ok: false, message: ERR_CAP };

  const connection = getConnection();
  try {
    tx.partialSign(keypairFromEnv("FEE_PAYER_SECRET_KEY"));
    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature, ...(await connection.getLatestBlockhash("confirmed")) }, "confirmed");
    await supabase.from("events").insert({
      user_id: ctx.userId,
      family_id: ctx.familyId,
      kid_id: ctx.kidId,
      wallet_id: k.spend.id,
      kind: "sent",
      amount_units: Number(units),
      counterparty: contact.address,
      signature,
      summary: `Sent ${unitsToDisplay(units)} to ${contact.label}`,
    });
    await consumeApproval(supabase, ctx, k, { requestId: input.requestId, contactId: contact.id, units });
    return { ok: true, explorerUrl: explorerUrl(signature, "tx") };
  } catch (error) {
    const balance = await getAccount(connection, ataFor(k.spend.wallet_address))
      .then((a) => a.amount)
      .catch(() => 0n);
    const logs = error && typeof error === "object" && "logs" in error ? ((error as { logs?: string[] }).logs ?? []) : [];
    const wrapped = error instanceof TxError ? error : new TxError((error as Error).message, logs);
    const reason = reasonFor(wrapped, balance, units);
    await recordBlocked(supabase, ctx, { walletId: k.spend.id, units, counterparty: contact.address, reason: reason.code, message: reason.message });
    return { ok: false, message: reason.message };
  }
}


// --- Jar moves: the kid's own money between spend and save. Same seam as a
// send (prepare, sign on the device, co-sign and submit) with a "jar_move"
// token; no contact rules or approval, only the balance and the sponsor cap.

export type PreparedJarMove = { ok: true; token: string; txBase64: string } | { ok: false; message: string };
export type JarMoveResult = { ok: true; explorerUrl: string } | { ok: false; message: string };

type JarWallet = { id: string; kind: JarMoveKind; swig_address: string; wallet_address: string };
const ERR_JAR_WALLET = "Your jars aren't ready yet. Ask a parent to check them.";
const ERR_JAR_DEVICE = "This device isn't on your jar yet. Ask a parent to approve it.";

async function loadJars(supabase: SupabaseClient, ctx: KidContext): Promise<Record<JarMoveKind, JarWallet> | null> {
  const { data } = await supabase.from("wallets").select("id,kind,swig_address,wallet_address").eq("kid_id", ctx.kidId).in("kind", ["spend", "save"]);
  const rows = (data as JarWallet[] | null) ?? [];
  const spend = rows.find((w) => w.kind === "spend");
  const save = rows.find((w) => w.kind === "save");
  return spend && save ? { spend, save } : null;
}

/** Check the amount against the source jar, then build the transfer for the kid's device to sign. */
export async function prepareJarMove(input: JarMoveInput): Promise<PreparedJarMove> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, message: NOT_A_KID[ctx.kind] };
  const check = validateJarMove(input);
  if (!check.ok) return check;
  const { move } = check;
  const supabase = await createClient();
  const jars = await loadJars(supabase, ctx);
  if (!jars) return { ok: false, message: ERR_JAR_WALLET };
  const { data: family } = await supabase.from("families").select("timezone").eq("id", ctx.familyId).maybeSingle();
  const timeZone = (family?.timezone as string | undefined) ?? DEFAULTS.timezone;
  if ((await countSponsoredToday(supabase, ctx.userId, timeZone)) >= SPONSORED_PER_DAY) return { ok: false, message: ERR_CAP };
  const { data: device } = await supabase.from("devices").select("pubkey").eq("id", ctx.deviceId).maybeSingle();
  if (!device) return { ok: false, message: NOT_A_KID.none };

  try {
    const connection = getConnection();
    const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
    const mint = usdcMint();
    const source = jars[move.from];
    const target = jars[move.to];
    const fromOwner = new PublicKey(source.wallet_address);
    const toOwner = new PublicKey(target.wallet_address);
    const fromAta = getAssociatedTokenAddressSync(mint, fromOwner, true);
    const toAta = getAssociatedTokenAddressSync(mint, toOwner, true);
    const balance = await getAccount(connection, fromAta)
      .then((a) => a.amount)
      .catch(() => 0n);
    const enough = checkJarBalance({ from: move.from, units: move.units, balanceUnits: balance });
    if (!enough.ok) return enough;
    const toAtaExists = await getAccount(connection, toAta).then(() => true).catch(() => false);
    const swig = await fetchSwig(connection, new PublicKey(source.swig_address));
    let roleId: number;
    try {
      roleId = roleIdFor(swig, new PublicKey(device.pubkey));
    } catch {
      return { ok: false, message: ERR_JAR_DEVICE };
    }
    const transfer = createTransferInstruction(fromAta, toAta, fromOwner, move.units, [], TOKEN_PROGRAM_ID);
    const ixs = await getSignInstructions(swig, roleId, [transfer], false, { payer: feePayer.publicKey });
    const tx = new Transaction();
    if (!toAtaExists) tx.add(createAssociatedTokenAccountIdempotentInstruction(feePayer.publicKey, toAta, toOwner, mint));
    tx.add(...ixs);
    tx.feePayer = feePayer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    const token = await issuePreparedToken({ userId: ctx.userId, messageHash: messageHashOf(tx), purpose: "jar_move" });
    return { ok: true, token, txBase64: bytesToBase64(new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }))) };
  } catch {
    return { ok: false, message: ERR_CHAIN };
  }
}

/** Co-sign and send the jar move the kid's device signed, then write it down as a "saved" event. */
export async function submitJarMove(input: JarMoveInput & { token: string; signedTxBase64: string }): Promise<JarMoveResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, message: NOT_A_KID[ctx.kind] };
  const claims = await verifyPreparedToken(input.token);
  if (!claims || claims.userId !== ctx.userId || claims.purpose !== "jar_move") return { ok: false, message: ERR_TOKEN };
  let tx: Transaction;
  try {
    tx = Transaction.from(base64ToBytes(input.signedTxBase64));
  } catch {
    return { ok: false, message: ERR_NOT_PREPARED };
  }
  if (messageHashOf(tx) !== claims.messageHash) return { ok: false, message: ERR_NOT_PREPARED };
  const check = validateJarMove(input);
  if (!check.ok) return check;
  const { move } = check;

  const supabase = await createClient();
  const jars = await loadJars(supabase, ctx);
  if (!jars) return { ok: false, message: ERR_JAR_WALLET };
  const { data: family } = await supabase.from("families").select("timezone").eq("id", ctx.familyId).maybeSingle();
  const timeZone = (family?.timezone as string | undefined) ?? DEFAULTS.timezone;
  if ((await countSponsoredToday(supabase, ctx.userId, timeZone)) >= SPONSORED_PER_DAY) return { ok: false, message: ERR_CAP };

  const source = jars[move.from];
  const target = jars[move.to];
  const connection = getConnection();
  try {
    tx.partialSign(keypairFromEnv("FEE_PAYER_SECRET_KEY"));
    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature, ...(await connection.getLatestBlockhash("confirmed")) }, "confirmed");
    await supabase.from("events").insert({
      user_id: ctx.userId,
      family_id: ctx.familyId,
      kid_id: ctx.kidId,
      wallet_id: source.id,
      kind: "saved",
      amount_units: Number(move.units),
      counterparty: target.wallet_address,
      signature,
      summary: jarMoveSummary(move.from, move.units),
    });
    return { ok: true, explorerUrl: explorerUrl(signature, "tx") };
  } catch (error) {
    const balance = await getAccount(connection, ataFor(source.wallet_address))
      .then((a) => a.amount)
      .catch(() => 0n);
    const logs = error && typeof error === "object" && "logs" in error ? ((error as { logs?: string[] }).logs ?? []) : [];
    const wrapped = error instanceof TxError ? error : new TxError((error as Error).message, logs);
    const reason = reasonFor(wrapped, balance, move.units);
    const enough = checkJarBalance({ from: move.from, units: move.units, balanceUnits: balance });
    const message = !enough.ok ? enough.message : reason.message;
    await recordBlocked(supabase, ctx, { walletId: source.id, units: move.units, counterparty: target.wallet_address, reason: reason.code, message });
    return { ok: false, message };
  }
}


// --- Share sends: from the share jar to someone on the list, only once a
// guardian has said yes to that person and amount today (see
// app/kid/share-actions.ts for the ask). Same seam as a send.

export type PreparedShareSend = { ok: true; token: string; txBase64: string; requestId: string } | { ok: false; message: string; needsApproval?: boolean };
export type ShareSendResult = { ok: true; explorerUrl: string } | { ok: false; message: string };

type ShareWallet = { id: string; swig_address: string; wallet_address: string };
const ERR_SHARE_WALLET = "Your share jar isn't ready yet. Ask a parent to check it.";
const ERR_SHARE_DEVICE = "This device isn't on your share jar yet. Ask a parent to approve it.";

async function loadShare(supabase: SupabaseClient, ctx: KidContext, now: Date, timeZone: string) {
  const [walletRes, contactRes, requestRes] = await Promise.all([
    supabase.from("wallets").select("id,swig_address,wallet_address").eq("kid_id", ctx.kidId).eq("kind", "share").maybeSingle(),
    supabase.from("contacts").select("id,label,avatar_id,address,weekly_limit_units,status").eq("kid_id", ctx.kidId),
    supabase.from("requests").select("id,status,payload,decided_at").eq("kid_id", ctx.kidId).eq("type", "share").eq("status", "approved").gte("decided_at", startOfDay(now, timeZone).toISOString()),
  ]);
  return {
    wallet: (walletRes.data as ShareWallet | null) ?? null,
    contacts: (contactRes.data as ContactRecord[] | null) ?? [],
    approvedRows: (requestRes.data as ShareRequestRow[] | null) ?? [],
  };
}

async function familyTimeZone(supabase: SupabaseClient, ctx: KidContext): Promise<string> {
  const { data } = await supabase.from("families").select("timezone").eq("id", ctx.familyId).maybeSingle();
  return (data?.timezone as string | undefined) ?? DEFAULTS.timezone;
}

/** Build the share transfer, only when a guardian's yes for this person and amount exists today. */
export async function prepareShareSend(input: { contactId: string; dollars: string }): Promise<PreparedShareSend> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, message: NOT_A_KID[ctx.kind] };
  const amount = validateShareAmount(input.dollars);
  if (!amount.ok) return amount;
  const supabase = await createClient();
  const now = new Date();
  const timeZone = await familyTimeZone(supabase, ctx);
  const share = await loadShare(supabase, ctx, now, timeZone);
  const contact = share.contacts.find((c) => c.id === input.contactId) ?? null;
  const allowed = checkShareContact(contact);
  if (!allowed.ok || !contact) return allowed.ok ? { ok: false, message: ERR_NOT_ON_LIST } : allowed;
  const approved = findApprovedShare(share.approvedRows, { contactId: contact.id, units: amount.units, now, timeZone });
  if (!approved) return { ok: false, needsApproval: true, message: "A parent hasn't said yes to this one yet. Ask from your share jar first." };
  if (!share.wallet) return { ok: false, message: ERR_SHARE_WALLET };
  if ((await countSponsoredToday(supabase, ctx.userId, timeZone)) >= SPONSORED_PER_DAY) return { ok: false, message: ERR_CAP };
  const { data: device } = await supabase.from("devices").select("pubkey").eq("id", ctx.deviceId).maybeSingle();
  if (!device) return { ok: false, message: NOT_A_KID.none };
  let to: PublicKey;
  try {
    to = new PublicKey(contact.address);
  } catch {
    return { ok: false, message: `${contact.label}'s wallet address doesn't look right. Ask a parent to check it.` };
  }

  try {
    const connection = getConnection();
    const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
    const mint = usdcMint();
    const owner = new PublicKey(share.wallet.wallet_address);
    const fromAta = getAssociatedTokenAddressSync(mint, owner, true);
    const toAta = getAssociatedTokenAddressSync(mint, to, true);
    const balance = await getAccount(connection, fromAta)
      .then((a) => a.amount)
      .catch(() => 0n);
    const enough = checkShareBalance(amount.units, balance);
    if (!enough.ok) return enough;
    const toAtaExists = await getAccount(connection, toAta).then(() => true).catch(() => false);
    const swig = await fetchSwig(connection, new PublicKey(share.wallet.swig_address));
    let roleId: number;
    try {
      roleId = roleIdFor(swig, new PublicKey(device.pubkey));
    } catch {
      return { ok: false, message: ERR_SHARE_DEVICE };
    }
    const transfer = createTransferInstruction(fromAta, toAta, owner, amount.units, [], TOKEN_PROGRAM_ID);
    const ixs = await getSignInstructions(swig, roleId, [transfer], false, { payer: feePayer.publicKey });
    const tx = new Transaction();
    if (!toAtaExists) tx.add(createAssociatedTokenAccountIdempotentInstruction(feePayer.publicKey, toAta, to, mint));
    tx.add(...ixs);
    tx.feePayer = feePayer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    const token = await issuePreparedToken({ userId: ctx.userId, messageHash: messageHashOf(tx), purpose: "share" });
    return { ok: true, token, requestId: approved.id, txBase64: bytesToBase64(new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }))) };
  } catch {
    return { ok: false, message: ERR_CHAIN };
  }
}

/** Co-sign and send the share the kid's device signed, write it down as "shared", and spend the guardian's yes. */
export async function submitShareSend(input: { token: string; signedTxBase64: string; contactId: string; dollars: string }): Promise<ShareSendResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, message: NOT_A_KID[ctx.kind] };
  const claims = await verifyPreparedToken(input.token);
  if (!claims || claims.userId !== ctx.userId || claims.purpose !== "share") return { ok: false, message: ERR_TOKEN };
  let tx: Transaction;
  try {
    tx = Transaction.from(base64ToBytes(input.signedTxBase64));
  } catch {
    return { ok: false, message: ERR_NOT_PREPARED };
  }
  if (messageHashOf(tx) !== claims.messageHash) return { ok: false, message: ERR_NOT_PREPARED };
  const amount = validateShareAmount(input.dollars);
  if (!amount.ok) return amount;

  const supabase = await createClient();
  const now = new Date();
  const timeZone = await familyTimeZone(supabase, ctx);
  const share = await loadShare(supabase, ctx, now, timeZone);
  const contact = share.contacts.find((c) => c.id === input.contactId);
  if (!contact || contact.status !== "active") return { ok: false, message: ERR_NOT_ON_LIST };
  if (!share.wallet) return { ok: false, message: ERR_SHARE_WALLET };
  // The yes is checked again where the fee payer actually signs.
  const approved = findApprovedShare(share.approvedRows, { contactId: contact.id, units: amount.units, now, timeZone });
  if (!approved) return { ok: false, message: "A parent hasn't said yes to this one yet." };
  if ((await countSponsoredToday(supabase, ctx.userId, timeZone)) >= SPONSORED_PER_DAY) return { ok: false, message: ERR_CAP };

  const connection = getConnection();
  try {
    tx.partialSign(keypairFromEnv("FEE_PAYER_SECRET_KEY"));
    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature, ...(await connection.getLatestBlockhash("confirmed")) }, "confirmed");
    await supabase.from("events").insert({
      user_id: ctx.userId,
      family_id: ctx.familyId,
      kid_id: ctx.kidId,
      wallet_id: share.wallet.id,
      kind: "shared",
      amount_units: Number(amount.units),
      counterparty: contact.address,
      signature,
      summary: shareSummary(amount.units, contact.label),
    });
    // Same as a send: the kid's own "used" mark goes through the service role until the RLS migration lands.
    const writer = getSupabaseAdmin() ?? supabase;
    await writer.from("requests").update({ status: "used" }).eq("id", approved.id).eq("kid_id", ctx.kidId).eq("status", "approved");
    return { ok: true, explorerUrl: explorerUrl(signature, "tx") };
  } catch (error) {
    const balance = await getAccount(connection, ataFor(share.wallet.wallet_address))
      .then((a) => a.amount)
      .catch(() => 0n);
    const logs = error && typeof error === "object" && "logs" in error ? ((error as { logs?: string[] }).logs ?? []) : [];
    const wrapped = error instanceof TxError ? error : new TxError((error as Error).message, logs);
    const reason = reasonFor(wrapped, balance, amount.units);
    const enough = checkShareBalance(amount.units, balance);
    const message = !enough.ok ? enough.message : reason.message;
    await recordBlocked(supabase, ctx, { walletId: share.wallet.id, units: amount.units, counterparty: contact.address, reason: reason.code, message });
    return { ok: false, message };
  }
}
