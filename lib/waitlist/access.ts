// Who may make an account, and who runs the waitlist. Pure: no Supabase.

export const WAITLIST_STATUSES = ["waiting", "accepted", "declined"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export function isWaitlistStatus(value: unknown): value is WaitlistStatus {
  return WAITLIST_STATUSES.includes(value as WaitlistStatus);
}

/**
 * The accounts that manage the waitlist at /admin: `ADMIN_EMAILS`, a
 * comma-separated list in the environment. Nobody is an admin when it is unset.
 */
export function adminEmails(env: Readonly<Record<string, string | undefined>> = process.env): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isAdminEmail(email: string | null | undefined, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  return normalized.length > 0 && adminEmails(env).includes(normalized);
}

/**
 * May signing in create a brand-new account for this email? Only an admin or
 * an accepted waitlist email. Anyone who already has an account (a guardian,
 * an invited kid) signs in regardless; this gate is for newcomers.
 */
export function mayCreateAccount(
  input: { email: string; status: WaitlistStatus | null },
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return isAdminEmail(input.email, env) || input.status === "accepted";
}

/** What a row's status is called on the admin screen. */
export const STATUS_LABEL: Record<WaitlistStatus, string> = { waiting: "Waiting", accepted: "Accepted", declined: "Declined" };
