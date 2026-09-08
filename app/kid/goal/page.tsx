import { GoalScreenLive } from "@/components/kid/GoalScreenLive";
import { getKidGoal } from "../data";
import { saveGoal } from "../jar-actions";
import { NotPaired } from "../not-paired";

export const metadata = { title: "Save jar" };

export default async function KidGoalPage() {
  const data = await getKidGoal();
  if (!data) return <NotPaired />;
  return (
    <GoalScreenLive
      saveDisplay={data.saveDisplay}
      saveUnits={data.saveUnits}
      spendDisplay={data.spendDisplay}
      spendUnits={data.spendUnits}
      goal={data.goal}
      onSave={saveGoal}
    />
  );
}
