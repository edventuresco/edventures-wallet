"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Menu, type LucideIcon } from "lucide-react";

/**
 * Fixed bottom navigation (spec section 3/4): up to four destinations and,
 * when `onMore` is given, a More item that opens the menu sheet. Selects
 * the current destination from `usePathname()`; labels stay visible next
 * to the icons (no icon-only nav). Every target is at least 44px.
 */
export type Destination = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match only this exact path, so a parent route does not light up for its children. */
  exact?: boolean;
  /** Rendered after the label, e.g. a live count. */
  badge?: ReactNode;
};

export type BottomNavProps = {
  /** The tabs, e.g. `GUARDIAN_DESTINATIONS` from `components/family/places`. */
  destinations: Destination[];
  /** When given, a More item is added at the end and calls this instead of navigating. */
  onMore?: () => void;
  /** Whether the sheet More opens is currently open (for `aria-expanded`). */
  moreOpen?: boolean;
  className?: string;
};

const item = "flex min-w-[44px] flex-1 flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-terracotta/40";

function Glyph({ icon: Icon, selected }: { icon: LucideIcon; selected: boolean }) {
  return (
    <span className={`flex h-8 w-11 items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none ${selected ? "bg-terracotta/15" : ""}`}>
      <Icon size={22} strokeWidth={2} className={selected ? "text-forest" : "text-ink/45"} aria-hidden="true" />
    </span>
  );
}

function Label({ children, selected }: { children: ReactNode; selected: boolean }) {
  return <span className={`flex items-center text-[13px] font-medium ${selected ? "text-forest" : "text-ink/55"}`}>{children}</span>;
}

export function BottomNav({ destinations, onMore, moreOpen = false, className }: BottomNavProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Primary"
      className={`border-t border-sand-dark bg-sand/95 backdrop-blur ${className ?? ""}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-[72px] w-full max-w-[560px] items-stretch justify-around">
        {destinations.map(({ href, label, icon, exact, badge }) => {
          const selected = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex flex-1">
              <Link href={href} aria-current={selected ? "page" : undefined} className={item}>
                <Glyph icon={icon} selected={selected} />
                <Label selected={selected}>
                  {label}
                  {badge}
                </Label>
              </Link>
            </li>
          );
        })}
        {onMore && (
          <li className="flex flex-1">
            <button type="button" onClick={onMore} aria-expanded={moreOpen} aria-haspopup="dialog" className={item}>
              <Glyph icon={Menu} selected={moreOpen} />
              <Label selected={moreOpen}>More</Label>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
