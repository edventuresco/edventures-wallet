/**
 * What to call the signed-in grown-up until they have a name of their own.
 * Guardians have a role label ("Parent", "Guardian") but no name column, so
 * the sign-in email stands in: the local part, minus any +tag, first word,
 * capitalised. "mark.smith+zoe@example.com" reads as "Mark".
 */
export function ownerNameFrom(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0].split("+")[0];
  const word = local.split(/[._-]+/).find((w) => w.length > 0) ?? "";
  if (!word) return "You";
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

/** "Mark's", "James'": the name as an owner, for titles. */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** The grown-up's chosen name (set on /onboarding), else the email stand-in. */
export function ownerNameOf(user: { name?: string | null; email?: string | null } | null | undefined): string {
  return user?.name?.trim() || ownerNameFrom(user?.email);
}
