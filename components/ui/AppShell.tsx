import type { ReactNode } from "react";

/**
 * The 390px-first page shell. Every screen renders its content as
 * `children` and starts with its own title; there is no header.
 * `bottomNav` (typically `<GuardianNav />`) is pinned to the bottom of the
 * viewport and the scrollable area gets enough bottom padding to clear it.
 *
 * Layout per docs/design/EDVENTURES-WALLET-UI-SPEC.md section 3:
 * - page gutter 20px at 390px, 24px at 430px+
 * - content max-width 560px, centered on tablet
 * - top safe-area inset + 24px
 * - scroll content clears the fixed bottom nav by 96px + the bottom inset
 *
 * Phones, tablets and (for now) desktop all get this; a desktop view is
 * later work and the `desktop` breakpoint in globals.css is where it
 * starts.
 */
export type AppShellProps = {
  /** Fixed bottom navigation. Omit for shell-less flows like onboarding. */
  bottomNav?: ReactNode;
  children: ReactNode;
};

export function AppShell({ bottomNav, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-sand">
      <main
        className="mx-auto w-full max-w-[560px] flex-1 px-5 min-[430px]:px-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 24px)",
          paddingBottom: bottomNav ? "calc(96px + env(safe-area-inset-bottom))" : "24px",
        }}
      >
        {children}
      </main>
      {bottomNav && <div className="fixed inset-x-0 bottom-0 z-10">{bottomNav}</div>}
    </div>
  );
}
