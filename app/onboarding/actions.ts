"use server";

// A new grown-up's first visit: their name, then (through the settings and
// wallet actions this screen reuses) this device, their wallet, and the
// family. The beta gate here backs the one on /login: an account that got
// in some other way still waits until its email is accepted.

import { requireUser } from "@/lib/auth/session";
import { getFamilyContext } from "@/lib/family/session";
import { validateDisplayName } from "@/lib/onboarding/name";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isWaitlistStatus, mayCreateAccount } from "@/lib/waitlist/access";
import { normalizeEmail } from "@/lib/waitlist/validate";

type Result = { ok: true } | { ok: false; error: string };

export type OnboardingState = {
  email: string | null;
  /** The name they chose, once they have. */
  name: string | null;
  hasWallet: boolean;
};

export async function getOnboardingState(): Promise<OnboardingState> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: wallet } = await supabase.from("wallets").select("id").eq("user_id", user.id).maybeSingle();
  return { email: user.email, name: user.name, hasWallet: Boolean(wallet) };
}

/** May this signed-in account go on: an admin, an accepted waitlist email, or one already in a family. */
export async function betaAccess(): Promise<"allowed" | "waiting"> {
  const user = await requireUser();
  const ctx = await getFamilyContext();
  if (ctx.kind === "guardian" || ctx.kind === "kid") return "allowed";
  const normalized = normalizeEmail(user.email ?? "");
  if (!normalized) return "waiting";
  const admin = getSupabaseAdmin();
  let status = null;
  if (admin) {
    const { data } = await admin.from("waitlist").select("status").eq("email_normalized", normalized).maybeSingle();
    status = isWaitlistStatus(data?.status) ? data.status : null;
  }
  return mayCreateAccount({ email: normalized, status }) ? "allowed" : "waiting";
}

/** Remember what to call them, on the auth user, and refresh the session so the new claims are in the cookie at once. */
export async function setDisplayName(raw: string): Promise<Result> {
  await requireUser();
  const check = validateDisplayName(raw);
  if (!check.ok) return { ok: false, error: check.error };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { display_name: check.name } });
  if (error) return { ok: false, error: "Couldn't save your name. Try again." };
  await supabase.auth.refreshSession();
  return { ok: true };
}
