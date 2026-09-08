import Link from "next/link";
import { GoalsScreen } from "@/components/family/GoalsScreen";
import { getGoalsPage } from "./actions";

export const metadata = { title: "Goals" };
export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const data = await getGoalsPage();
  if (!data) return <NoFamily />;
  return <GoalsScreen data={data} />;
}

function NoFamily() {
  return (
    <div className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5">
      <h1 className="text-3xl text-forest">Goals</h1>
      <p className="text-ink/70">Start your family first. Trips, activities and other things you save for together show up here.</p>
      <Link href="/onboarding" className="inline-block text-sm font-semibold text-forest underline">
        Set up your family
      </Link>
    </div>
  );
}
