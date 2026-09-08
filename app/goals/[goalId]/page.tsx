import Link from "next/link";
import { GoalDetailScreen } from "@/components/family/GoalDetailScreen";
import { getGoal } from "../actions";

export const dynamic = "force-dynamic";

export default async function GoalPage({ params }: { params: Promise<{ goalId: string }> }) {
  const { goalId } = await params;
  const goal = await getGoal(goalId);
  if (!goal) return <NotFound />;
  return <GoalDetailScreen goal={goal} />;
}

function NotFound() {
  return (
    <div className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5">
      <h1 className="text-2xl text-forest">That goal isn&apos;t here</h1>
      <p className="text-ink/70">It may be closed, or it belongs to another family.</p>
      <Link href="/goals" className="inline-block text-sm font-semibold text-forest underline">
        Back to goals
      </Link>
    </div>
  );
}
