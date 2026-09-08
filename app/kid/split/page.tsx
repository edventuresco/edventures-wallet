import { SplitScreen } from "@/components/kid/SplitScreen";
import { getKidSplit } from "../data";
import { saveSplit } from "../jar-actions";
import { NotPaired } from "../not-paired";

export const metadata = { title: "Split" };

export default async function KidSplitPage() {
  const data = await getKidSplit();
  if (!data) return <NotPaired />;
  return <SplitScreen split={data.split} allowanceDisplay={data.allowanceDisplay} allowanceUnits={data.allowanceUnits} onSave={saveSplit} />;
}
