import Link from "next/link";
import { RequestsScreen } from "@/components/family/RequestsScreen";
import { getRequests } from "./actions";

export const metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const screen = await getRequests();
  if (!screen) return <NoFamily />;
  return <RequestsScreen {...screen} />;
}

function NoFamily() {
  return (
    <div className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5">
      <h1 className="text-2xl text-forest">Requests</h1>
      <p className="text-ink/70">Set up your family first. When a kid asks to send more than their threshold, it waits here.</p>
      <Link href="/family" className="inline-block text-sm font-semibold text-forest underline">
        Go to family
      </Link>
    </div>
  );
}
