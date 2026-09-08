// Sign-in codes go out through Resend, not Supabase's mailer. Supabase still
// mints and checks the code: the service role asks it to generate a
// magic-link (or invite) token, we take the six digits it hands back and
// email them ourselves, and the browser's verifyOtp({ type: "email" })
// accepts the same digits. Server-only: this imports the service role.

import { signInCodeEmail } from "@/lib/auth/code-email";
import { sendEmail } from "@/lib/email/resend";
import { appOrigin } from "@/lib/marketing/links";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type SendCodeInput =
  | { kind: "sign_in"; email: string; /** false: an unknown email gets not_invited instead of an account. */ mayCreateAccount: boolean }
  | { kind: "kid_invite"; email: string; kidName: string };

export type SendCodeResult = { ok: true } | { ok: false; reason: "not_invited" | "send_failed" };

/**
 * Whether an auth user with this (normalized) email exists. The admin users
 * endpoint's `filter` is a LIKE on email, so the match is checked exactly.
 * supabase-js's listUsers does not expose the filter, hence plain fetch.
 */
export async function authUserExists(email: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role not configured");
  const res = await fetch(`${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=50`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`auth admin users: ${res.status}`);
  const body = (await res.json()) as { users?: Array<{ email?: string | null }> };
  return (body.users ?? []).some((u) => (u.email ?? "").toLowerCase() === email);
}

/** Generates the code for this email (creating the account when Supabase does) and emails it through Resend. */
export async function sendSignInCode(input: SendCodeInput): Promise<SendCodeResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error("sendSignInCode: service role not configured");
    return { ok: false, reason: "send_failed" };
  }
  const email = input.email;

  let code: string | null = null;
  try {
    if (input.kind === "kid_invite") {
      // A new address becomes an invited user carrying the kid's role; one already registered just gets a sign-in code.
      const invited = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: { wallet_role: "kid", kid_name: input.kidName } } });
      if (!invited.error) code = invited.data.properties?.email_otp ?? null;
      else if (isAlreadyRegistered(invited.error.message)) code = await magicLinkCode(admin, email);
      else throw invited.error;
    } else {
      // A magic-link token for an unknown email creates the account, so the gate is checked here, not by Supabase.
      if (!input.mayCreateAccount && !(await authUserExists(email))) return { ok: false, reason: "not_invited" };
      code = await magicLinkCode(admin, email);
    }
  } catch (err) {
    console.error("sendSignInCode: could not generate a code", err);
    return { ok: false, reason: "send_failed" };
  }
  if (!code) {
    console.error("sendSignInCode: Supabase returned no email_otp");
    return { ok: false, reason: "send_failed" };
  }

  const message = signInCodeEmail({ code, loginUrl: `${appOrigin()}/login`, kidName: input.kind === "kid_invite" ? input.kidName : undefined });
  const sent = await sendEmail({ to: email, ...message });
  if (!sent.ok) {
    console.error("sendSignInCode: Resend refused the email", sent.error);
    return { ok: false, reason: "send_failed" };
  }
  return { ok: true };
}

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

async function magicLinkCode(admin: Admin, email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return data.properties?.email_otp ?? null;
}

function isAlreadyRegistered(message: string): boolean {
  return /already (been )?registered|already exists/i.test(message);
}
