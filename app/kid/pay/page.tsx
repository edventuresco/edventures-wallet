import Link from "next/link";
import { PayShopFlow } from "@/components/kid/PayShopFlow";
import { getFamilyContext } from "@/lib/family/session";

export const metadata = { title: "Pay a shop" };

export default async function KidPayPage() {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") {
    return (
      <section className="space-y-6">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-8 text-center ring-1 ring-sand-dark">
          <span aria-hidden="true" className="text-5xl leading-none">
            🦉
          </span>
          <h1 className="font-display text-[26px] font-semibold leading-8 text-kid-green">Not on this device</h1>
          <p className="max-w-xs text-lg leading-7 text-ink">Paying a shop works on a paired kid device. Ask a parent to pair this one.</p>
        </div>
        <Link href="/kid" className="flex h-14 w-full items-center justify-center rounded-2xl bg-kid-orange text-xl font-bold text-white">
          Back home
        </Link>
      </section>
    );
  }
  return <PayShopFlow />;
}
