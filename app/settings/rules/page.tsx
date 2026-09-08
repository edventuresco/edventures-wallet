import Link from "next/link";
import { RulesScreen } from "@/components/family/RulesScreen";
import { getRulesScreen } from "@/app/family/rules/actions";

export const metadata = { title: "Rules" };
export const dynamic = "force-dynamic";

/** Each kid's limits and who they can send to. Lives under Settings; the actions stay next to /family. */
export default async function RulesPage() {
  const screen = await getRulesScreen();
  if (!screen) return <NoFamily />;
  return <RulesScreen {...screen} />;
}

function NoFamily() {
  return (
    <div className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5">
      <h1 className="text-2xl text-forest">Rules</h1>
      <p className="text-ink/70">Set up your family first, then the rules live here.</p>
      <Link href="/family" className="inline-block text-sm font-semibold text-forest underline">
        Go to family
      </Link>
    </div>
  );
}
