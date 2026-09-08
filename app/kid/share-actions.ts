"use server";

import { getAccount } from "@solana/spl-token";
import type { SendContact } from "@/components/kid/send/ContactGrid";
import { DEFAULTS } from "@/lib/family/defaults";
import { ataFor } from "@/lib/family/onchain";
import { getFamilyContext } from "@/lib/family/session";
import { checkShareBalance, checkShareContact, findApprovedShare, validateShareAmount, type ShareRequestRow } from "@/lib/family/share";
import { startOfDay } from "@/lib/kid/rules";
import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";
import { getConnection } from "@/lib/solana/connection";
import { createClient } from "@/lib/supabase/server";

export type ApprovedShareView = { requestId: string; contactId: string; dollars: string; label: string; amountDisplay: string };
export type PendingShareView = { contactId: string; dollars: string; label: string };

export type KidShareContext =
  | {
      ok: true;
      contacts: SendContact[];
      /** Share-jar balance in base units as a decimal string; bigint cannot cross to the client. */
      shareUnits: string;
      shareDisplay: string;
      parentName: string;
      /** A guardian's yes today the kid has not used: one tap shares it. */
      approvedShare: ApprovedShareView | null;
      /** The newest ask still waiting on a guardian. */
      pendingShare: PendingShareView | null;
    }
  | { ok: false; error: string };

export type RequestShareResult = { ok: true } | { ok: false; message: string };

type ContactRecord = { id: string; label: string; avatar_id: string; status: "active" | "requested" | "removed" };
type PendingRow = { payload: { contactId?: string; dollars?: string; label?: string } | null };

const NOT_A_KID = "This device isn't set up yet. Ask a parent to invite you.";

/** "$22.00" -> "22.00": what goes in a request payload, parsed back by dollarsToUnits. */
const bareDollars = (units: bigint) => unitsToDisplay(units).replace(/[$,]/g, "");

async function shareBalance(walletAddress: string | undefined): Promise<bigint> {
  if (!walletAddress) return 0n;
  return getAccount(getConnection(), ataFor(walletAddress))
    .then((a) => a.amount)
    .catch(() => 0n);
}

/** What the kid's Share screen and the home's share card need. */
export async function getKidShareContext(): Promise<KidShareContext> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, error: NOT_A_KID };
  const supabase = await createClient();
  const now = new Date();
  const [{ data: family }, { data: contacts }, { data: wallet }, { data: guardian }] = await Promise.all([
    supabase.from("families").select("timezone").eq("id", ctx.familyId).maybeSingle(),
    supabase.from("contacts").select("id,label,avatar_id,status").eq("kid_id", ctx.kidId).order("created_at"),
    supabase.from("wallets").select("wallet_address").eq("kid_id", ctx.kidId).eq("kind", "share").maybeSingle(),
    supabase.from("guardians").select("label").eq("family_id", ctx.familyId).limit(1).maybeSingle(),
  ]);
  const timeZone = (family?.timezone as string | undefined) ?? DEFAULTS.timezone;
  const dayStart = startOfDay(now, timeZone).toISOString();
  const [{ data: approvedRows }, { data: pendingRows }, balance] = await Promise.all([
    supabase.from("requests").select("id,status,payload,decided_at").eq("kid_id", ctx.kidId).eq("type", "share").eq("status", "approved").gte("decided_at", dayStart),
    supabase.from("requests").select("payload").eq("kid_id", ctx.kidId).eq("type", "share").eq("status", "pending").order("created_at", { ascending: false }).limit(1),
    shareBalance(wallet?.wallet_address),
  ]);

  const all = (contacts as ContactRecord[] | null) ?? [];
  const active = all.filter((c) => c.status === "active");
  const parentName = all.find((c) => c.avatar_id === "parent")?.label ?? (guardian?.label === "Guardian" ? "Guardian" : "Mum");
  const approved = findApprovedShare((approvedRows as ShareRequestRow[] | null) ?? [], { now, timeZone });
  const approvedContact = approved ? active.find((c) => c.id === approved.contactId) : undefined;
  const pending = ((pendingRows as PendingRow[] | null) ?? [])[0]?.payload;
  const pendingContact = pending?.contactId ? active.find((c) => c.id === pending.contactId) : undefined;

  return {
    ok: true,
    contacts: active.map((c) => ({ id: c.id, label: c.label, avatarId: c.avatar_id })),
    shareUnits: balance.toString(),
    shareDisplay: unitsToDisplay(balance),
    parentName,
    approvedShare:
      approved && approvedContact
        ? { requestId: approved.id, contactId: approvedContact.id, dollars: approved.dollars, label: approvedContact.label, amountDisplay: unitsToDisplay(approved.units) }
        : null,
    pendingShare: pending?.dollars && pendingContact ? { contactId: pendingContact.id, dollars: pending.dollars, label: pendingContact.label } : null,
  };
}

/**
 * The kid asks to share. Every share needs a guardian's yes, so this only
 * files the request (one pending ask per person and amount); the send
 * happens later through prepareShareSend / submitShareSend.
 */
export async function requestShare(input: { contactId: string; dollars: string }): Promise<RequestShareResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, message: NOT_A_KID };
  const amount = validateShareAmount(input.dollars);
  if (!amount.ok) return amount;
  const supabase = await createClient();
  const [{ data: contact }, { data: wallet }] = await Promise.all([
    supabase.from("contacts").select("id,label,avatar_id,status").eq("kid_id", ctx.kidId).eq("id", input.contactId).maybeSingle(),
    supabase.from("wallets").select("wallet_address").eq("kid_id", ctx.kidId).eq("kind", "share").maybeSingle(),
  ]);
  const allowed = checkShareContact((contact as ContactRecord | null) ?? null);
  if (!allowed.ok || !contact) return allowed.ok ? { ok: false, message: "That person isn't on your list yet. Ask a parent to add them." } : allowed;
  const enough = checkShareBalance(amount.units, await shareBalance(wallet?.wallet_address));
  if (!enough.ok) return enough;

  const { data: pending } = await supabase.from("requests").select("payload").eq("kid_id", ctx.kidId).eq("type", "share").eq("status", "pending");
  const already = ((pending as PendingRow[] | null) ?? []).some((r) => {
    try {
      return r.payload?.contactId === contact.id && r.payload?.dollars !== undefined && dollarsToUnits(r.payload.dollars) === amount.units;
    } catch {
      return false;
    }
  });
  if (already) return { ok: true };

  const { error } = await supabase.from("requests").insert({
    family_id: ctx.familyId,
    kid_id: ctx.kidId,
    type: "share",
    payload: { contactId: contact.id, dollars: bareDollars(amount.units), label: contact.label },
    status: "pending",
  });
  if (error) return { ok: false, message: "That didn't go through. Try again in a moment." };
  return { ok: true };
}
