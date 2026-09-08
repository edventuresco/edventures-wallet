import type { FamilyOverviewProps, KidSummary } from "./contract";
import { PROFILE_ICON_EMOJI } from "./contract";

/**
 * Starting point for the parent home screen. Britt: replace freely; keep the
 * props from contract.ts and the actions from app/parent/actions.ts.
 */
export function FamilyOverview({ familyName, kids, pendingRequests }: FamilyOverviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-forest">{familyName}</h1>
        <p className="text-ink/70">Rules live on-chain. Change them here.</p>
      </div>

      {pendingRequests.length > 0 && (
        <section className="rounded-2xl border border-sand-dark bg-white p-4">
          <h2 className="text-lg text-forest">Requests</h2>
          <ul className="mt-2 space-y-2">
            {pendingRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span>{r.summary}</span>
                <span className="rounded-full bg-terracotta px-3 py-1 text-xs font-semibold text-sand">
                  Review
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        {kids.map((kid) => (
          <KidCard key={kid.id} kid={kid} />
        ))}
      </section>
    </div>
  );
}

function KidCard({ kid }: { kid: KidSummary }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-sand-dark">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {PROFILE_ICON_EMOJI[kid.icon]}
        </span>
        <div className="flex-1">
          <h2 className="text-xl text-forest">{kid.name}</h2>
          <p className="text-sm text-ink/60">Ages {kid.ageBand}</p>
        </div>
        <p className="font-display text-2xl text-forest">{kid.balance.display}</p>
      </div>
      <ul className="mt-4 space-y-1 text-sm text-ink/80">
        {kid.rules.lines.map((line) => (
          <li key={line} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
      {kid.lastEvent && (
        <p className="mt-4 rounded-xl bg-sand px-3 py-2 text-sm text-ink/70">{kid.lastEvent.summary}</p>
      )}
    </article>
  );
}
