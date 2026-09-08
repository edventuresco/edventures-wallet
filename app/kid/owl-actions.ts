"use server";

import { getFamilyContext } from "@/lib/family/session";
import { checkOwlName } from "@/lib/owl/name";
import { createClient } from "@/lib/supabase/server";

export type NameOwlResult = { ok: true; name: string } | { ok: false; error: string };

/**
 * The kid names their owl. Validated with checkOwlName (length, letters,
 * blocklist); a rejected name is never echoed back. Writes only the kid's
 * own row, which RLS (kids_self_update_split) allows from a paired device.
 */
export async function nameOwl(name: string): Promise<NameOwlResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, error: "Only your own device can name your owl." };
  const check = checkOwlName(name);
  if (!check.ok) return { ok: false, error: "Try another name" };
  const supabase = await createClient();
  const { error } = await supabase.from("kids").update({ owl_name: check.name }).eq("id", ctx.kidId);
  if (error) return { ok: false, error: "Couldn't save that name. Try again." };
  return { ok: true, name: check.name };
}
