import { redirect } from "next/navigation";
import { FamilyFeedSection } from "@/components/family/FamilyFeedSection";
import { FamilySetup } from "@/components/family/FamilySetup";
import { getFamilyState } from "./actions";
import { hasKidInvite } from "@/app/join/actions";
import { getFamilyContext } from "@/lib/family/session";

export const metadata = { title: "Family" };
export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const ctx = await getFamilyContext();
  if (ctx.kind === "signed_out") redirect("/login");
  if (ctx.kind === "kid") redirect("/kid");
  // An invited kid whose emailed link lost its destination still ends up joining.
  if (ctx.kind === "none" && (await hasKidInvite())) redirect("/join");
  // A new grown-up sets up their name, device, wallet and family on /onboarding.
  if (ctx.kind === "none") redirect("/onboarding");
  const state = await getFamilyState();
  return <FamilySetup initial={state} feed={<FamilyFeedSection />} />;
}
