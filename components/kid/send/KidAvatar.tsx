"use client";

import Image from "next/image";
import { AVATARS } from "@/lib/avatars";

const SPECIAL: Record<string, string> = {
  parent: "💛",
  family: "🏡",
  shop: "🛍️",
};

const SIZE = {
  compact: "size-9 text-[20px] ring-2",
  standard: "size-[52px] text-[28px]",
  selector: "size-[72px] text-[38px]",
  hero: "size-[96px] text-[52px]",
} as const;

/**
 * A round face for a person on the kid's list. Known ids render the
 * matching profile emoji; anything else falls back to the first letter
 * so a missing asset never breaks a tile.
 */
export function KidAvatar({
  avatarId,
  label,
  size = "selector",
  className = "",
}: {
  avatarId: string;
  label: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const avatar = AVATARS.find((a) => a.id === avatarId);
  const emoji = avatar?.emoji ?? SPECIAL[avatarId];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-4 ring-kid-sage/40 ${SIZE[size]} ${className}`}
    >
      {avatar?.src ? (
        <Image src={avatar.src} alt="" width={96} height={96} className="size-full object-cover" />
      ) : (
        (emoji ?? <span className="font-display font-semibold text-kid-green">{label.charAt(0).toUpperCase()}</span>)
      )}
    </span>
  );
}
