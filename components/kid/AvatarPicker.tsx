"use client";

import Image from "next/image";
import { useRef } from "react";
import { AVATARS } from "@/lib/avatars";

type Props = {
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

/**
 * A grid of 72px selector tiles to pick a FamilyAvatar (see the UI spec).
 * Behaves as a radio group: one tile is selected at a time, arrow keys move
 * the selection, and each name renders as live text beneath its tile.
 */
export function AvatarPicker({ value, onChange, className }: Props) {
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = AVATARS.findIndex((avatar) => avatar.id === value);

  function selectByIndex(index: number) {
    const wrapped = (index + AVATARS.length) % AVATARS.length;
    onChange(AVATARS[wrapped].id);
    tileRefs.current[wrapped]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        selectByIndex(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        selectByIndex(index - 1);
        break;
      case "Home":
        event.preventDefault();
        selectByIndex(0);
        break;
      case "End":
        event.preventDefault();
        selectByIndex(AVATARS.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div role="radiogroup" aria-label="Choose an avatar" className={`grid grid-cols-4 gap-x-3 gap-y-5 ${className ?? ""}`}>
      {AVATARS.map((avatar, index) => {
        const selected = avatar.id === value;
        const tabbable = selected || (selectedIndex === -1 && index === 0);

        return (
          <button
            key={avatar.id}
            ref={(el) => {
              tileRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(avatar.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className="flex flex-col items-center gap-2 rounded-2xl p-1 outline-none focus-visible:ring-4 focus-visible:ring-terracotta/35"
          >
            <span
              className={`flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-white ring-2 transition-colors motion-reduce:transition-none ${
                selected ? "ring-terracotta" : "ring-sand-dark"
              }`}
            >
              {avatar.kind === "illustrated" && avatar.src ? (
                <Image
                  src={avatar.src}
                  alt=""
                  width={72}
                  height={72}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span aria-hidden="true" className="text-4xl leading-none">
                  {avatar.emoji}
                </span>
              )}
            </span>
            <span className="max-w-[72px] truncate text-xs font-medium text-ink">{avatar.label}</span>
          </button>
        );
      })}
    </div>
  );
}
