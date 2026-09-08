"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult, RequestsScreenProps, RequestView } from "@/components/family/contract";
import { getFamilyContext } from "@/lib/family/session";
import { startOfDay } from "@/lib/kid/rules";
import { dollarsToUnits, toView } from "@/lib/money/usdc";
import { avatarEmoji, currentFamily, familyKids, type KidRow } from "@/lib/rules/family";
import { clockLabel } from "@/lib/rules/tz";
import { createClient } from "@/lib/supabase/server";

type RequestRecord = {
  id: string;
  type: RequestView["type"];
  kid_id: string;
  payload: { contactId?: string; dollars?: string; label?: string } | null;
  status: RequestView["status"];
  created_at: string;
  decided_at: string | null;
};

const COLUMNS = "id,type,kid_id,payload,status,created_at,decided_at";
/** Every ask a kid can make lands here; an add_contact yes still needs the address typed on the Rules screen. */
const DECIDED_TYPES: RequestView["type"][] = ["approve_send", "share", "add_contact"];
const ERR_NOT_GUARDIAN = "Only a guardian can decide a request.";

const WHEN: Record<RequestView["status"], string> = { pending: "Asked", approved: "Approved", declined: "Declined", used: "Sent" };

/** A row the kid's device wrote, made safe to render; null when it cannot be (unknown kid, unreadable amount). */
function viewOf(r: RequestRecord, kids: KidRow[], timeZone: string): RequestView | null {
  const kid = kids.find((k) => k.id === r.kid_id);
  if (!kid) return null;
  let amount: RequestView["amount"] = null;
  if (r.type !== "add_contact") {
    if (!r.payload?.dollars) return null;
    try {
      amount = toView(dollarsToUnits(r.payload.dollars));
    } catch {
      return null;
    }
  } else if (!r.payload?.label) {
    return null;
  }
  const when = r.status === "pending" || !r.decided_at ? r.created_at : r.decided_at;
  return {
    id: r.id,
    type: r.type === "share" ? "share" : r.type === "add_contact" ? "add_contact" : "approve_send",
    kidName: kid.name,
    kidEmoji: avatarEmoji(kid.avatar_id),
    contactLabel: r.payload?.label || "someone on their list",
    amount,
    status: r.status,
    whenLabel: `${WHEN[r.status]} at ${clockLabel(new Date(when), timeZone)}`,
  };
}

/** Pending asks first, then whatever was decided today. Null when the guardian has no family yet. */
export async function getRequests(): Promise<RequestsScreenProps | null> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return null;
  const supabase = await createClient();
  const family = await currentFamily(supabase);
  if (!family) return null;
  const dayStart = startOfDay(new Date(), family.timezone).toISOString();

  const [kids, pendingRes, decidedRes] = await Promise.all([
    familyKids(supabase, family.id),
    supabase.from("requests").select(COLUMNS).eq("family_id", family.id).in("type", DECIDED_TYPES).eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("requests").select(COLUMNS).eq("family_id", family.id).in("type", DECIDED_TYPES).neq("status", "pending").gte("decided_at", dayStart).order("decided_at", { ascending: false }),
  ]);
  const views = (rows: RequestRecord[] | null) => (rows ?? []).map((r) => viewOf(r, kids, family.timezone)).filter((v): v is RequestView => v !== null);
  return {
    familyName: family.name,
    pending: views(pendingRes.data as RequestRecord[] | null),
    decided: views(decidedRes.data as RequestRecord[] | null),
  };
}

/** Say yes or no to one pending ask. Only the guardian of that family; only while it is still pending. */
export async function decideRequest(id: string, decision: "approved" | "declined"): Promise<ActionResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: ERR_NOT_GUARDIAN };
  if (decision !== "approved" && decision !== "declined") return { ok: false, error: "A request is approved or declined, nothing else." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("requests")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("family_id", ctx.familyId)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, error: "That couldn't be saved. Try again." };
  if (!data?.length) return { ok: false, error: "That request was already decided." };
  revalidatePath("/family/requests");
  return { ok: true };
}
