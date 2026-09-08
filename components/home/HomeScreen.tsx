import Link from "next/link";
import { QrCode, Repeat, ScanLine, Send, type LucideIcon } from "lucide-react";
import type { HomeState } from "@/app/home-actions";
import { FamilyFeed } from "@/components/family/FamilyFeed";
import { TestDollarsButton } from "@/components/home/TestDollarsButton";
import { possessive } from "@/lib/family/owner";

/**
 * The grown-up's home: their name, their balance, four things to do with
 * it, and their own recent moves. The family lives under the Family tab.
 * Server component; nothing here needs the device key.
 */
export function HomeScreen({ state }: { state: HomeState }) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl text-forest">{possessive(state.ownerName)} personal wallet</h1>
        <p className="text-sm text-ink/60">{state.familyName ? `Yours to send, receive, pay and swap from. ${state.familyName} is under Family.` : "Yours to send, receive, pay and swap from."}</p>
      </header>

      <section className="rounded-[22px] bg-forest p-5 text-sand">
        <p className="text-sm">Balance</p>
        {state.balance ? (
          <>
            <p className="font-display text-4xl tabular-nums text-white">{state.balance.display}</p>
            {state.canAddTestDollars && <TestDollarsButton />}
          </>
        ) : (
          <p className="text-white">
            No wallet yet.{" "}
            <Link href="/wallet" className="underline">
              Create one
            </Link>
          </p>
        )}
      </section>

      <nav aria-label="Actions" className="grid grid-cols-4 gap-2">
        <Action href="/receive" label="Receive" icon={QrCode} />
        <Action href="/wallet" label="Send" icon={Send} />
        <Action href="/pay" label="Pay" icon={ScanLine} />
        <Action href="/swap" label="Swap" icon={Repeat} />
      </nav>

      <FamilyFeed items={state.transactions} title="Your moves" />
    </div>
  );
}

function Action({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return (
    <Link href={href} className="flex min-h-[44px] flex-col items-center gap-2 rounded-2xl py-2 hover:bg-sand-dark/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-terracotta/40">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest text-white shadow-[0_8px_28px_rgba(34,31,26,0.08)]">
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="text-[13px] font-medium leading-tight text-ink/80">{label}</span>
    </Link>
  );
}
