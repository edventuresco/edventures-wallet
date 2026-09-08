import Link from "next/link";
import { SyncChip } from "@/components/family/ui";
import { Avatar } from "@/components/kid/Avatar";
import type { KidDetailView } from "@/lib/family/kid-detail";

const card = "space-y-3 rounded-[22px] border border-sand-dark bg-white p-5";
const quietLink = "text-sm font-semibold text-forest underline";
const explorerLink = "text-xs text-forest underline";

/**
 * The guardian's read-only view of one kid: what they hold, who they can
 * pay, the rules in force, and the receipts. Editing lives in Allowance and
 * Rules; this page only links there, so it has no primary button.
 */
export function KidDetail({ view }: { view: KidDetailView }) {
  const { kid, device, jars, allowance, contacts, limits, proof } = view;
  return (
    <div className="space-y-6">
      <Link href="/family" className="inline-flex items-center gap-1 text-sm text-forest">
        <span aria-hidden>←</span> Family
      </Link>

      <header className="flex items-center gap-3">
        <Avatar id={kid.avatarId} size="standard" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl text-forest">{kid.name}</h1>
          <p className="text-sm text-ink/60">{kid.age === null ? "Age not set" : `Age ${kid.age}`}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${device.paired ? "bg-sage/20 text-forest" : "bg-sand-dark text-ink/70"}`}>{device.label}</span>
      </header>

      <section className={card}>
        <h2 className="text-xl text-forest">Jars</h2>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {jars.map((jar) => (
            <div key={jar.kind} className="space-y-1 rounded-xl bg-sand px-2 py-3">
              <dt className="text-xs text-ink/60">{jar.label}</dt>
              <dd className="text-lg font-semibold tabular-nums text-ink">{jar.balance}</dd>
              {jar.explorerUrl ? (
                <a href={jar.explorerUrl} target="_blank" rel="noreferrer" className={explorerLink}>
                  See on Solana
                </a>
              ) : (
                <span className="text-xs text-ink/50">Not on Solana yet</span>
              )}
            </div>
          ))}
        </dl>
      </section>

      <section className={card}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl text-forest">Allowance</h2>
          <Link href="/family/allowance" className={quietLink}>
            Change
          </Link>
        </div>
        <p className="text-ink">{allowance ? allowance.line : "No allowance yet."}</p>
      </section>

      <section className={card}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl text-forest">People on the list</h2>
          <Link href="/family/rules" className={quietLink}>
            Edit
          </Link>
        </div>
        {contacts.length === 0 && <p className="text-sm text-ink/60">No one on the list yet.</p>}
        {contacts.length > 0 && (
          <ul className="divide-y divide-sand-dark">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <span className="text-2xl" aria-hidden>
                  {c.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{c.label}</p>
                  <p className="text-xs text-ink/60">{c.weeklyCap} a week</p>
                </div>
                <SyncChip synced={c.onchainSynced} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl text-forest">Limits</h2>
          <div className="flex items-center gap-3">
            <SyncChip synced={limits.onchainSynced} />
            <Link href="/family/rules" className={quietLink}>
              Edit
            </Link>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-ink/60">Daily limit</dt>
          <dd className="text-right tabular-nums text-forest">{limits.daily}</dd>
          <dt className="text-ink/60">Weekly limit</dt>
          <dd className="text-right tabular-nums text-forest">{limits.weekly}</dd>
          <dt className="text-ink/60">Approval threshold</dt>
          <dd className="text-right tabular-nums text-forest">{limits.approval}</dd>
        </dl>
        {limits.pendingLine && <p className="text-xs text-ink/70">{limits.pendingLine}</p>}
      </section>

      <section className={card}>
        <h2 className="text-xl text-forest">Proof</h2>
        {proof.length === 0 && <p className="text-sm text-ink/60">Nothing on the record yet.</p>}
        {proof.length > 0 && (
          <ol className="divide-y divide-sand-dark">
            {proof.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{e.summary}</p>
                  <p className="text-xs text-ink/60">
                    <time dateTime={e.atISO} title={e.atLabel}>
                      {e.whenLabel}
                    </time>
                  </p>
                </div>
                {e.explorerUrl && (
                  <a href={e.explorerUrl} target="_blank" rel="noreferrer" className={`shrink-0 ${explorerLink}`}>
                    See on Solana
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
