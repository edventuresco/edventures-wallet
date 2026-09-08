import { redirect } from "next/navigation";
import { NotInBeta } from "@/components/onboarding/NotInBeta";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { hasKidInvite } from "@/app/join/actions";
import { getFamilyContext } from "@/lib/family/session";
import { betaAccess, getOnboardingState } from "./actions";

export const metadata = { title: "Set up" };
export const dynamic = "force-dynamic";

/** A new grown-up's first stop after signing in; done once, then home is /. */
export default async function OnboardingPage() {
  const ctx = await getFamilyContext();
  if (ctx.kind === "signed_out") redirect("/login");
  if (ctx.kind === "kid") redirect("/kid");
  if (ctx.kind === "guardian") redirect("/");
  if (await hasKidInvite()) redirect("/join");
  const state = await getOnboardingState();
  if ((await betaAccess()) === "waiting") return <NotInBeta email={state.email} />;
  return <OnboardingScreen initial={state} />;
}
