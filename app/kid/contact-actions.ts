"use server";

import { getFamilyContext } from "@/lib/family/session";
import { validateContactRequest } from "@/lib/rules/contacts";
import { createClient } from "@/lib/supabase/server";

export type RequestContactResult = { ok: true; label: string } | { ok: false; error: string };

/**
 * The kid asks for someone new on their list. Only a guardian can add the
 * person (they need the address), so this files a request the guardian
 * sees on their phone. RLS (requests_kid_insert) scopes it to the kid's own
 * family and id.
 */
export async function requestContact(name: string): Promise<RequestContactResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, error: "Only your own device can ask." };
  const check = validateContactRequest(name);
  if (!check.ok) return check;
  const supabase = await createClient();
  const { error } = await supabase
    .from("requests")
    .insert({ family_id: ctx.familyId, kid_id: ctx.kidId, type: "add_contact", payload: { label: check.label }, status: "pending" });
  if (error) return { ok: false, error: "That didn't go through. Try again in a moment." };
  return { ok: true, label: check.label };
}
