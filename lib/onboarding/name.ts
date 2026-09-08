// The grown-up's own name, asked once on /onboarding. Pure.

export const DISPLAY_NAME_MAX = 40;

export type DisplayNameCheck = { ok: true; name: string } | { ok: false; error: string };

/** Trims and collapses spaces; a name is required and short. */
export function validateDisplayName(raw: string): DisplayNameCheck {
  const name = (typeof raw === "string" ? raw : "").trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Tell us what to call you." };
  if (name.length > DISPLAY_NAME_MAX) return { ok: false, error: `Keep it to ${DISPLAY_NAME_MAX} characters.` };
  return { ok: true, name };
}
