import { containsBlockedWord } from "@/lib/owl/blocklist";

export type OwlNameCheck = { ok: true; name: string } | { ok: false };

const MIN_LENGTH = 2;
const MAX_LENGTH = 16;
// Letters, spaces, and hyphens only; must start and end with a letter (no
// leading/trailing hyphen). MIN_LENGTH already guarantees at least 2 chars.
const ALLOWED_CHARS_RE = /^[A-Za-z](?:[A-Za-z\s-]*[A-Za-z])?$/;

/**
 * Validates a kid-chosen owl name: trims, requires 2–16 characters of
 * letters/spaces/hyphens only, and rejects anything that normalises to a
 * blocklisted word (see lib/owl/blocklist.ts). Never echoes a rejected name
 * back — callers should show a generic "Try another name" message.
 */
export function checkOwlName(name: string): OwlNameCheck {
  const trimmed = name.trim().replace(/\s+/g, " ");

  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
    return { ok: false };
  }

  if (!ALLOWED_CHARS_RE.test(trimmed)) {
    return { ok: false };
  }

  if (containsBlockedWord(trimmed)) {
    return { ok: false };
  }

  return { ok: true, name: trimmed };
}
