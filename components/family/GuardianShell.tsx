import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { getFamilyContext } from "@/lib/family/session";
import { GuardianNav } from "./GuardianNav";
import { RequestsCount } from "./RequestsCount";

/**
 * The grown-up side's shell: adult palette, the footer on every page. Wrap
 * a route's layout (or the home page) in it. Signed-out visitors go to
 * login. A kid device is sent to its own home, unless the page is for
 * everyone (`kids="allow"`, e.g. Settings), in which case the kid gets the
 * content without the guardian footer.
 */
export async function GuardianShell({ children, kids = "redirect" }: { children: ReactNode; kids?: "redirect" | "allow" }) {
  const ctx = await getFamilyContext();
  if (ctx.kind === "signed_out") redirect("/login");
  if (ctx.kind === "kid") {
    if (kids === "redirect") redirect("/kid");
    return <AppShell>{children}</AppShell>;
  }
  return (
    <AppShell
      bottomNav={
        <Suspense fallback={<GuardianNav />}>
          <GuardianNav requestsBadge={<RequestsCount />} />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
