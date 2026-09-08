import Image from "next/image";
import { avatarById } from "@/lib/avatars";

const SIZE_PX = {
  compact: 36,
  standard: 52,
  selector: 72,
} as const;

export type AvatarSize = keyof typeof SIZE_PX;

type Props = {
  id: string;
  size?: AvatarSize;
  className?: string;
};

/**
 * Renders one avatar by id at a fixed size (see FamilyAvatar in the UI
 * spec). The circular rim is always preserved; names are never baked into
 * the image, so pair this with live text wherever a name should show.
 */
export function Avatar({ id, size = "standard", className }: Props) {
  const avatar = avatarById(id);
  const px = SIZE_PX[size];

  return (
    <span
      role="img"
      aria-label={avatar.label}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-sand-dark ${className ?? ""}`}
      style={{ width: px, height: px }}
    >
      {avatar.kind === "illustrated" && avatar.src ? (
        <Image
          src={avatar.src}
          alt=""
          width={px}
          height={px}
          className="h-full w-full object-contain"
        />
      ) : (
        <span aria-hidden="true" style={{ fontSize: Math.round(px * 0.55) }}>
          {avatar.emoji}
        </span>
      )}
    </span>
  );
}
