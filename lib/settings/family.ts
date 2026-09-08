// Pure helpers for the Family section of Settings. No Supabase, no Solana.

export const GUARDIAN_LABELS = ["Parent", "Guardian"] as const;
export type GuardianLabel = (typeof GUARDIAN_LABELS)[number];

export function isGuardianLabel(value: unknown): value is GuardianLabel {
  return GUARDIAN_LABELS.includes(value as GuardianLabel);
}

export const FAMILY_NAME_MAX = 40;

export type FamilyNameCheck = { ok: true; name: string } | { ok: false; error: string };

/** Trims and collapses spaces; the family needs a name, and a short one. */
export function validateFamilyName(raw: string): FamilyNameCheck {
  const name = (typeof raw === "string" ? raw : "").trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Give the family a name." };
  if (name.length > FAMILY_NAME_MAX) return { ok: false, error: `Keep the family name to ${FAMILY_NAME_MAX} characters.` };
  return { ok: true, name };
}
