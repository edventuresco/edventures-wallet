"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, ScanLine, Target, type LucideIcon } from "lucide-react";

type Destination = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const DESTINATIONS: Destination[] = [
  { href: "/kid", label: "Home", icon: Home, exact: true },
  { href: "/kid/goal", label: "Goal", icon: Target },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/kid/pay", label: "Pay", icon: ScanLine },
];

/**
 * The kid's four places, fixed to the bottom in the kid palette. Labels
 * stay visible and every target is at least 44px. Home matches only its
 * exact route so the other kid pages can light up their own tab.
 */
export function KidNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Kid"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-sand-dark bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-[72px] max-w-md items-stretch justify-around">
        {DESTINATIONS.map(({ href, label, icon: Icon, exact }) => {
          const selected = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={selected ? "page" : undefined}
                className="flex min-w-[44px] flex-1 flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50"
              >
                <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none ${selected ? "bg-kid-sun/70" : ""}`}>
                  <Icon size={22} strokeWidth={2} className={selected ? "text-kid-green" : "text-ink/45"} aria-hidden="true" />
                </span>
                <span className={`text-[13px] font-semibold ${selected ? "text-kid-green" : "text-ink/55"}`}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
