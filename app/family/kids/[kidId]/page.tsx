import Link from "next/link";
import { redirect } from "next/navigation";
import { KidDetail } from "@/components/family/KidDetail";
import { getFamilyContext } from "@/lib/family/session";
import { getKidDetail } from "./actions";

export const dynamic = "force-dynamic";

export default async function KidDetailPage({ params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  const ctx = await getFamilyContext();
  if (ctx.kind === "signed_out") redirect("/login");
  if (ctx.kind === "kid") redirect("/kid");
  const view = await getKidDetail(kidId);
  if (!view) return <NotInFamily />;
  return <KidDetail view={view} />;
}

function NotInFamily() {
  return (
    <div className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5">
      <h1 className="text-2xl text-forest">That kid isn&apos;t in your family</h1>
      <p className="text-ink/70">The link may be old, or it belongs to another family.</p>
      <Link href="/family" className="inline-block text-sm font-semibold text-forest underline">
        Go to family
      </Link>
    </div>
  );
}
