import Link from "next/link";
import { redirect } from "next/navigation";
import { AddMoneyScreen } from "@/components/family/AddMoneyScreen";
import { getFamilyContext } from "@/lib/family/session";
import { getAddMoneyContext } from "../actions";

export const metadata = { title: "Add money" };
export const dynamic = "force-dynamic";

export default async function AddMoneyPage({ params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  const ctx = await getFamilyContext();
  if (ctx.kind === "signed_out") redirect("/login");
  if (ctx.kind === "kid") redirect("/kid");
  const context = await getAddMoneyContext(kidId);
  if (!context) return <NotInFamily />;
  return <AddMoneyScreen context={context} />;
}

function NotInFamily() {
  return (
    <div className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5">
      <h1 className="text-2xl text-forest">That kid isn&apos;t in your family</h1>
      <Link href="/family" className="inline-block text-sm font-semibold text-forest underline">
        Go to family
      </Link>
    </div>
  );
}
