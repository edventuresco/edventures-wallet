import Link from "next/link";
import { AllowanceScreen } from "@/components/family/AllowanceScreen";
import { getAllowanceScreen } from "./actions";

export const metadata = { title: "Allowance" };
export const dynamic = "force-dynamic";

export default async function AllowancePage() {
  const screen = await getAllowanceScreen();
  if (!screen) return <NoFamily />;
  return <AllowanceScreen {...screen} />;
}

function NoFamily() {
  return (
    <div className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5">
      <h1 className="text-2xl text-forest">Allowance</h1>
      <p className="text-ink/70">Set up your family first, then set each allowance here.</p>
      <Link href="/family" className="inline-block text-sm font-semibold text-forest underline">
        Go to family
      </Link>
    </div>
  );
}
