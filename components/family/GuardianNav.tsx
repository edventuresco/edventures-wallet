"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { MenuDrawer } from "@/components/ui/MenuDrawer";
import { GUARDIAN_DESTINATIONS, GUARDIAN_MENU } from "./places";

/**
 * The guardian's footer: Home, Family, Goals and More, which opens the
 * sheet with Settings and Sign out. Navigating anywhere
 * closes the sheet. A client component because the icons are functions
 * and cannot be handed across from a server component; the one
 * server-rendered piece, the live Requests count on the Family tab,
 * arrives as a node (`<RequestsCount />` from `GuardianShell`).
 */
export function GuardianNav({ requestsBadge }: { requestsBadge?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const destinations = GUARDIAN_DESTINATIONS.map((d) => (d.href === "/family" ? { ...d, badge: requestsBadge } : d));
  return (
    <>
      <BottomNav destinations={destinations} onMore={() => setOpen(true)} moreOpen={open} />
      <MenuDrawer open={open} onClose={close} items={GUARDIAN_MENU}>
        <form action="/logout" method="post">
          <button type="submit" className="min-h-[44px] text-sm font-semibold text-forest underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </MenuDrawer>
    </>
  );
}
