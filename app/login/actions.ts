"use server";

import { sendSignInCode } from "@/lib/auth/send-code";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isWaitlistStatus, mayCreateAccount, type WaitlistStatus } from "@/lib/waitlist/access";
import { normalizeEmail } from "@/lib/waitlist/validate";

export type RequestCodeResult = { ok: true } | { ok: false; reason: "invalid_email" | "not_invited" | "send_failed" };

/**
 * Email a sign-in code through Resend (lib/auth/send-code.ts). A brand-new
 * account is created only for an accepted waitlist email or an admin
 * (lib/waitlist/access.ts); everyone who already has an account, guardians
 * and invited kids alike, signs in as before.
 */
export async function requestSignInCode(email: string): Promise<RequestCodeResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, reason: "invalid_email" };

  let status: WaitlistStatus | null = null;
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data } = await admin.from("waitlist").select("status").eq("email_normalized", normalized).maybeSingle();
    status = isWaitlistStatus(data?.status) ? data.status : null;
  }
  return sendSignInCode({ kind: "sign_in", email: normalized, mayCreateAccount: mayCreateAccount({ email: normalized, status }) });
}
