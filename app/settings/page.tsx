import { redirect } from "next/navigation";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { getFamilyContext } from "@/lib/family/session";
import { getSettingsState } from "./actions";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** Adult palette only, whoever is looking: this is the grown-up side of every account. */
export default async function SettingsPage() {
  const ctx = await getFamilyContext();
  if (ctx.kind === "signed_out") redirect("/login");
  const state = await getSettingsState();
  return <SettingsScreen initial={state} />;
}
