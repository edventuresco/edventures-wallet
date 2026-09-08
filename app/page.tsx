import { redirect } from "next/navigation";
import { GuardianShell } from "@/components/family/GuardianShell";
import { HomeScreen } from "@/components/home/HomeScreen";
import { LandingPage } from "@/components/marketing/LandingPage";
import { hasKidInvite } from "@/app/join/actions";
import { getFamilyContext } from "@/lib/family/session";
import { getHomeState } from "./home-actions";

export const dynamic = "force-dynamic";

/**
 * The front door. Signed out, it is the landing page (the same one
 * edventures.co/wallet shows). A signed-in guardian gets their wallet home;
 * a kid device goes to its own; a new grown-up goes to /onboarding first,
 * or to /join when a parent's invite is waiting. Also where a magic link
 * lands when its destination was lost.
 */
export default async function EntryPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  const ctx = await getFamilyContext();
  if (ctx.kind === "signed_out") return <LandingPage />;
  if (ctx.kind === "kid") redirect("/kid");
  if (ctx.kind === "none") redirect((await hasKidInvite()) ? "/join" : "/onboarding");
  const state = await getHomeState();
  if (!state) return <LandingPage />;
  return (
    <GuardianShell>
      <HomeScreen state={state} />
    </GuardianShell>
  );
}
