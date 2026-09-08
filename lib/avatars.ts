/**
 * The avatar set a family member picks from during setup.
 *
 * Three illustrated avatars use the brand PNGs in public/illustrations/
 * (see docs/design/EDVENTURES-WALLET-UI-SPEC.md, FamilyAvatar). The rest are a curated
 * set of animal emoji, chosen to render well on iOS, for families who want
 * more choice than the three named characters.
 */

export type AvatarKind = "illustrated" | "emoji";

export type Avatar = {
  id: string;
  kind: AvatarKind;
  label: string;
  /** Set when kind is "illustrated"; a path under /illustrations/. */
  src?: string;
  /** Set when kind is "emoji". */
  emoji?: string;
};

const ILLUSTRATED_AVATARS: Avatar[] = [
  { id: "maya", kind: "illustrated", label: "Maya", src: "/illustrations/avatar-maya.png" },
  { id: "aria", kind: "illustrated", label: "Aria", src: "/illustrations/avatar-aria.png" },
  { id: "eli", kind: "illustrated", label: "Eli", src: "/illustrations/avatar-eli.png" },
];

/** id, label, and emoji for the animal set. Order is the picker order. */
const ANIMAL_EMOJI: Array<{ id: string; label: string; emoji: string }> = [
  { id: "otter", label: "Otter", emoji: "🦦" },
  { id: "fox", label: "Fox", emoji: "🦊" },
  { id: "panda", label: "Panda", emoji: "🐼" },
  { id: "koala", label: "Koala", emoji: "🐨" },
  { id: "owl", label: "Owl", emoji: "🦉" },
  { id: "bunny", label: "Bunny", emoji: "🐰" },
  { id: "puppy", label: "Puppy", emoji: "🐶" },
  { id: "kitten", label: "Kitten", emoji: "🐱" },
  { id: "sloth", label: "Sloth", emoji: "🦥" },
  { id: "penguin", label: "Penguin", emoji: "🐧" },
  { id: "turtle", label: "Turtle", emoji: "🐢" },
  { id: "dolphin", label: "Dolphin", emoji: "🐬" },
  { id: "elephant", label: "Elephant", emoji: "🐘" },
  { id: "lion", label: "Lion", emoji: "🦁" },
  { id: "tiger", label: "Tiger", emoji: "🐯" },
  { id: "frog", label: "Frog", emoji: "🐸" },
  { id: "bee", label: "Bee", emoji: "🐝" },
  { id: "butterfly", label: "Butterfly", emoji: "🦋" },
  { id: "hedgehog", label: "Hedgehog", emoji: "🦔" },
  { id: "whale", label: "Whale", emoji: "🐳" },
];

const EMOJI_AVATARS: Avatar[] = ANIMAL_EMOJI.map(({ id, label, emoji }) => ({
  id,
  kind: "emoji",
  label,
  emoji,
}));

/** All 23 avatars: 3 illustrated characters, then 20 animal emoji. */
export const AVATARS: Avatar[] = [...ILLUSTRATED_AVATARS, ...EMOJI_AVATARS];

/** A neutral starting point for anyone who has not picked one yet. */
export const DEFAULT_AVATAR_ID = "otter";

/** Look up an avatar by id, falling back to the default when it's missing. */
export function avatarById(id: string | null | undefined): Avatar {
  const found = id ? AVATARS.find((avatar) => avatar.id === id) : undefined;
  if (found) return found;
  const fallback = AVATARS.find((avatar) => avatar.id === DEFAULT_AVATAR_ID);
  if (!fallback) {
    throw new Error("DEFAULT_AVATAR_ID does not match any entry in AVATARS");
  }
  return fallback;
}
