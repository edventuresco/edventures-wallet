// Basic RFC-ish email check: local@domain.tld, no spaces. Good enough to
// catch typos before we hit the database; Postgres's unique index catches
// the rest.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims and lowercases an email, returning null when it doesn't look valid. */
export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length > 254 || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}