"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";

/**
 * The More sheet: rises from the bottom over the page, above the footer,
 * with the places that do not earn a tab. Modal while open: Escape, the
 * Close button and the backdrop all close it, focus starts on Close, and
 * the page behind stops scrolling. The caller owns `open` (see
 * `GuardianNav`).
 */
export type MenuItem = { href: string; label: string; icon: LucideIcon };

export type MenuDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  items: MenuItem[];
  /** Anything below the links, e.g. a sign-out form or a version line. */
  children?: ReactNode;
};

export function MenuDrawer({ open, onClose, title = "More", items, children }: MenuDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end">
      {/* Pointer-only: keyboard users close with Escape or the Close button. */}
      <div aria-hidden="true" data-testid="menu-backdrop" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative mx-auto w-full max-w-[560px] rounded-t-[22px] bg-sand px-5 pt-3 shadow-2xl ring-1 ring-sand-dark min-[430px]:px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-sand-dark" aria-hidden="true" />
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl text-forest">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-full text-forest hover:bg-sand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-terracotta/40"
          >
            <X size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <ul className="divide-y divide-sand-dark">
          {items.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-[52px] items-center gap-3 text-lg text-forest hover:text-terracotta">
                <Icon size={22} strokeWidth={2} className="text-ink/60" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        {children && <div className="mt-4 border-t border-sand-dark pt-4">{children}</div>}
      </div>
    </div>
  );
}
