import { Home, Settings, Target, Users } from "lucide-react";
import type { Destination } from "@/components/ui/BottomNav";
import type { MenuItem } from "@/components/ui/MenuDrawer";

/**
 * The guardian's places. A plain module (no "use client", no server
 * imports) so the client nav and the kit gallery can both read it. The
 * icons are functions, so this must never cross from a server component
 * into a client one as a prop: import it where it is rendered instead.
 */

/** The footer's three tabs; the fourth item is More. The kid's live in `components/kid/KidNav`. */
export const GUARDIAN_DESTINATIONS: Destination[] = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/family", label: "Family", icon: Users },
  { href: "/goals", label: "Goals", icon: Target },
];

/** What More lists: the places that do not earn a tab. Activity is reached from Family, Rules from Settings. */
export const GUARDIAN_MENU: MenuItem[] = [{ href: "/settings", label: "Settings", icon: Settings }];
