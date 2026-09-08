/**
 * A kid's list: the people, family and shops they can send to. Guardians
 * add and remove; kids can only ask. Pure checks live here so both the
 * screen and the server action say the same thing.
 */

import { AVATARS } from "@/lib/avatars";
import { isValidPubkey } from "@/lib/device/key";
import { dollarsToUnits } from "@/lib/money/usdc";

export const LABEL_MAX = 24;
const LABEL_RE = /^[\p{L}\p{N} .'&-]+$/u;
const DOLLARS_RE = /^\d+(?:\.\d{1,2})?$/;

export type ContactAvatarOption = { id: string; label: string; emoji: string };

/** The specials first (a person with no picture, the parent, the family wallet, a shop), then the animal set. */
export const CONTACT_AVATAR_OPTIONS: readonly ContactAvatarOption[] = [
  { id: "person", label: "Person", emoji: "🧒" },
  { id: "parent", label: "Parent", emoji: "💛" },
  { id: "family", label: "Family", emoji: "🏡" },
  { id: "shop", label: "Shop", emoji: "🛍️" },
  ...AVATARS.filter((a): a is typeof a & { emoji: string } => a.kind === "emoji" && Boolean(a.emoji)).map((a) => ({ id: a.id, label: a.label, emoji: a.emoji })),
];

const AVATAR_IDS = new Set(CONTACT_AVATAR_OPTIONS.map((o) => o.id));

export type NewContactInput = { label: string; avatarId: string; address: string; weeklyDollars: string };
export type NewContactCheck =
  | { ok: true; contact: { label: string; avatarId: string; address: string; weeklyUnits: bigint } }
  | { ok: false; error: string };

function cleanLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function validateNewContact(input: NewContactInput): NewContactCheck {
  const label = cleanLabel(input.label);
  if (!label) return { ok: false, error: "Give this person a name." };
  if (label.length > LABEL_MAX || !LABEL_RE.test(label)) return { ok: false, error: "Keep the name short and simple: letters and numbers only." };
  if (!AVATAR_IDS.has(input.avatarId)) return { ok: false, error: "Pick a picture for them." };
  const address = input.address.trim();
  if (!isValidPubkey(address)) return { ok: false, error: "That doesn't look like a Solana address. Paste the whole thing." };
  const dollars = input.weeklyDollars.trim();
  if (!DOLLARS_RE.test(dollars)) return { ok: false, error: "The weekly limit needs to be a dollar amount, like 20 or 12.50." };
  const weeklyUnits = dollarsToUnits(dollars);
  if (weeklyUnits <= 0n) return { ok: false, error: "The weekly limit needs to be more than $0." };
  return { ok: true, contact: { label, avatarId: input.avatarId, address, weeklyUnits } };
}

export type ContactRequestCheck = { ok: true; label: string } | { ok: false; error: string };

/** What a kid types when asking for someone new: just a name. */
export function validateContactRequest(raw: string): ContactRequestCheck {
  const label = cleanLabel(raw);
  if (!label) return { ok: false, error: "Type their name first." };
  if (label.length > LABEL_MAX || !LABEL_RE.test(label)) return { ok: false, error: "Just their name, nice and short." };
  return { ok: true, label };
}
