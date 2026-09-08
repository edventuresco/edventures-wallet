"use server";

import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeCountryCode } from "@/lib/waitlist/countries";
import { normalizeEmail } from "@/lib/waitlist/validate";

export type JoinWaitlistResult = { ok: true; already: boolean } | { ok: false; error: "invalid_email" | "unavailable" };

export async function joinWaitlist(input: { email: string; country?: string; kids?: number }): Promise<JoinWaitlistResult> {
  const normalized = normalizeEmail(input.email);
  if (!normalized) return { ok: false, error: "invalid_email" };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "unavailable" };

  const userAgent = (await headers()).get("user-agent");
  const kids = input.kids && input.kids >= 1 && input.kids <= 6 ? input.kids : null;

  const { error } = await admin.from("waitlist").insert({
    email: input.email.trim(),
    email_normalized: normalized,
    country: normalizeCountryCode(input.country ?? ""),
    kids,
    source: "landing",
    user_agent: userAgent,
  });

  if (error?.code === "23505") return { ok: true, already: true };
  if (error) return { ok: false, error: "unavailable" };
  return { ok: true, already: false };
}
