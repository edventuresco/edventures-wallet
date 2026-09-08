"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createGoal, reopenGoal, type ClosedGoalItem, type GoalListItem, type GoalsPageData } from "@/app/goals/actions";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RuleNotice } from "@/components/family/ui";
import { GoalForm } from "./GoalForm";

const card = "rounded-[22px] border border-sand-dark bg-white p-5";

/**
 * The family's goals: sub-savings accounts for trips, activities and other
 * things everyone saves toward. Money in a goal is set aside from the
 * family wallet, not moved, so the page leads with what is free. The kids'
 * own jar goals, set on their devices, sit at the bottom, read-only.
 */
export function GoalsScreen({ data }: { data: GoalsPageData }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl text-forest">Goals</h1>
          <p className="text-sm text-ink/60">What the family is saving for. Set money aside from the family wallet; it stays put until you spend it.</p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="shrink-0 rounded-xl bg-terracotta px-4 py-2 text-sm font-semibold text-white">
            New goal
          </button>
        )}
      </header>

      {data.wallet && (
        <p className="text-sm text-ink/70">
          Family wallet {data.wallet.balance.display} · {data.wallet.setAside.display} set aside · <span className="font-semibold text-forest">{data.wallet.free.display} free</span>
        </p>
      )}

      {creating && (
        <section className={`${card} space-y-3`} aria-labelledby="new-goal-heading">
          <h2 id="new-goal-heading" className="text-xl text-forest">
            New goal
          </h2>
          {error && <RuleNotice tone="problem">{error}</RuleNotice>}
          <GoalForm
            kids={data.kids}
            submitLabel="Start the goal"
            busy={busy}
            onCancel={() => setCreating(false)}
            onSubmit={async (draft) => {
              setBusy(true);
              setError(null);
              try {
                const result = await createGoal(draft);
                if (!result.ok) return setError(result.error);
                router.push(`/goals/${result.goalId}`);
              } catch {
                setError("That didn't work. Try again.");
              } finally {
                setBusy(false);
              }
            }}
          />
        </section>
      )}

      {data.goals.length === 0 && !creating && (
        <section className={`${card} space-y-2`}>
          <p className="text-ink/80">No goals yet. A trip, a bike, a season of swimming: pick something and save for it together.</p>
          <button type="button" onClick={() => setCreating(true)} className="text-sm font-semibold text-forest underline">
            Start the first goal
          </button>
        </section>
      )}

      {data.goals.length > 0 && (
        <ul className="space-y-4">
          {data.goals.map((g) => (
            <li key={g.id}>
              <GoalRow goal={g} />
            </li>
          ))}
        </ul>
      )}

      {data.closedGoals.length > 0 && <ClosedGoals goals={data.closedGoals} />}

      {data.jarGoals.length > 0 && (
        <section className="space-y-3" aria-labelledby="jar-goals-heading">
          <div className="space-y-1">
            <h2 id="jar-goals-heading" className="text-xl text-forest">
              Jar goals
            </h2>
            <p className="text-sm text-ink/60">Each kid picks one on their own device; their Save jar fills it.</p>
          </div>
          {data.jarGoals.map((k) => (
            <section key={k.kidId} className={`${card} space-y-3`}>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="text-2xl">
                  {k.kidEmoji}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-forest">{k.kidName}</h3>
                  <p className="text-sm text-ink/60">{k.savedDisplay} in the jar</p>
                </div>
              </div>
              {k.goal ? (
                <>
                  <p className="text-ink">
                    <span aria-hidden="true">{k.goal.emoji} </span>
                    {k.goal.title}
                  </p>
                  <ProgressBar value={k.goal.progress.percent} valueLabel={k.goal.progress.amountLabel} />
                  <p className="text-sm text-ink/70">
                    {k.goal.progress.amountLabel} · {k.goal.progress.percentLabel}
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink/70">No jar goal yet. {k.kidName} can pick one on their device.</p>
              )}
            </section>
          ))}
        </section>
      )}
    </div>
  );
}

function GoalRow({ goal }: { goal: GoalListItem }) {
  return (
    <Link href={`/goals/${goal.id}`} className={`${card} block space-y-3 shadow-[0_8px_28px_rgba(34,31,26,0.08)]`}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">{goal.ownerLabel}</p>
          <h2 className="font-display text-2xl font-semibold text-forest">
            <span aria-hidden>{goal.emoji} </span>
            {goal.title}
          </h2>
          <p className="text-lg text-ink">
            <span className="font-semibold">{goal.savedDisplay}</span> <span className="text-ink/60">of {goal.targetDisplay}</span>
          </p>
          {goal.targetDateLabel && <p className="text-xs text-ink/60">{goal.targetDateLabel}</p>}
        </div>
        {goal.art && <Image src={goal.art} alt="" width={240} height={120} className="h-16 w-28 shrink-0 rounded-xl object-cover" />}
      </div>
      <ProgressBar value={goal.progress.percent} valueLabel={goal.progress.percentLabel} />
      <div className="flex items-center justify-between">
        <ul className="flex items-center -space-x-1" aria-label="Who has put money in">
          {goal.participants.map((p) => (
            <li key={p.name} title={p.name} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-sand-dark text-sm">
              <span aria-hidden>{p.emoji}</span>
              <span className="sr-only">{p.name}</span>
            </li>
          ))}
          {goal.participants.length === 0 && <li className="text-xs text-ink/60">Nothing set aside yet</li>}
        </ul>
        <span className="text-sm font-semibold text-forest">{goal.progress.percentLabel}</span>
      </div>
    </Link>
  );
}

/** Goals a guardian stopped. Nothing is lost when a goal closes, so they stay here, folded away, with a way back. */
function ClosedGoals({ goals }: { goals: ClosedGoalItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <details className={`${card} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-forest">
        <span>Closed goals</span>
        <span className="text-xs text-ink/60">
          {goals.length} <span aria-hidden className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <p className="mt-2 text-xs text-ink/60">What was set aside went back to the family wallet&apos;s free money when each goal closed. Reopen one and it starts from what is saved now.</p>
      {error && (
        <div className="mt-2">
          <RuleNotice tone="problem">{error}</RuleNotice>
        </div>
      )}
      <ul className="mt-2 divide-y divide-sand-dark">
        {goals.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-ink">
                <span aria-hidden>{g.emoji} </span>
                {g.title}
              </p>
              <p className="text-xs text-ink/60">
                {g.ownerLabel} · {g.closedLabel}
              </p>
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                setBusy(g.id);
                setError(null);
                try {
                  const result = await reopenGoal(g.id);
                  if (!result.ok) setError(result.error);
                  else router.refresh();
                } catch {
                  setError("That didn't work. Try again.");
                } finally {
                  setBusy(null);
                }
              }}
              className="shrink-0 text-sm font-semibold text-forest underline disabled:opacity-60"
            >
              {busy === g.id ? "Reopening…" : "Reopen"}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
