"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { archiveGoal, releaseContribution, setAside, updateGoal, type GoalDetail } from "@/app/goals/actions";
import { PrimaryButton, RuleNotice, SecondaryButton } from "@/components/family/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GoalForm } from "./GoalForm";

const card = "rounded-[22px] border border-sand-dark bg-white p-5";

/**
 * One goal, per the UI spec's shared-goal page: hero, title, "$3,680 saved",
 * "61% of $6,000", contributions by person, and "Add to our goal". A
 * guardian can take any contribution back, change the goal, or stop it:
 * that asks first, frees the money, and leaves the goal reopenable.
 */
export function GoalDetailScreen({ goal }: { goal: GoalDetail }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "add" | "edit" | "stop">("view");
  const [dollars, setDollars] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "problem"; text: string } | null>(null);

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) {
    setBusy(label);
    setNotice(null);
    try {
      const result = await fn();
      if (!result.ok) setNotice({ tone: "problem", text: result.error ?? "That didn't work. Try again." });
      else {
        if (done) setNotice({ tone: "info", text: done });
        router.refresh();
      }
      return result.ok;
    } catch {
      setNotice({ tone: "problem", text: "That didn't work. Try again." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/goals" className="inline-flex items-center gap-1 text-sm text-forest">
        <span aria-hidden>←</span> Goals
      </Link>

      {goal.art && <Image src={goal.art} alt="" width={1774} height={887} priority className="h-auto w-full rounded-[22px] object-cover" />}

      <header className="space-y-1">
        <h1 className="font-display text-4xl font-semibold text-forest">
          <span aria-hidden>{goal.emoji} </span>
          {goal.title}
        </h1>
        <p className="text-ink/70">
          {goal.ownerLabel}
          {goal.targetDateLabel ? ` · ${goal.targetDateLabel}` : ""}
        </p>
      </header>

      <section className="space-y-2">
        <p className="font-display text-4xl font-semibold text-forest">
          {goal.savedDisplay} <span className="text-2xl font-normal">saved</span>
        </p>
        <p className="text-lg text-ink">
          <span className="font-semibold">{goal.progress.percentLabel}</span> <span className="text-ink/60">of {goal.targetDisplay}</span>
        </p>
        <ProgressBar value={goal.progress.percent} valueLabel={goal.progress.amountLabel} />
      </section>

      <p className="rounded-2xl bg-sand-dark/60 px-5 py-4 font-display text-lg italic text-forest">“{goal.blurb}”</p>

      {notice && <RuleNotice tone={notice.tone}>{notice.text}</RuleNotice>}

      <section className="space-y-3" aria-labelledby="contributions-heading">
        <h2 id="contributions-heading" className="text-xl text-forest">
          Contributions
        </h2>
        {goal.contributors.length === 0 && <p className="text-sm text-ink/70">Nothing set aside yet. Be the first.</p>}
        <ul className="space-y-3">
          {goal.contributors.map((c) => (
            <li key={c.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="text-ink">
                  <span className="font-semibold tabular-nums">{c.display}</span> <span className="text-sm text-ink/60">{c.percentLabel}</span>
                </p>
              </div>
              <ProgressBar value={c.percent} valueLabel={`${c.name}: ${c.display}, ${c.percentLabel} of what is saved`} />
            </li>
          ))}
        </ul>
      </section>

      {mode === "view" && (
        <div className="space-y-3">
          <PrimaryButton onClick={() => setMode("add")} disabled={busy !== null}>
            Add to our goal
          </PrimaryButton>
          <p className="text-center text-sm text-ink/60">Different contributions. Same direction.</p>
        </div>
      )}

      {mode === "add" && (
        <form
          className={`${card} space-y-3`}
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run("add", () => setAside(goal.id, dollars), `${dollars.trim().startsWith("$") ? dollars.trim() : `$${dollars.trim()}`} set aside for ${goal.title}.`);
            if (ok) {
              setDollars("");
              setMode("view");
            }
          }}
        >
          <h2 className="text-xl text-forest">Add to our goal</h2>
          <p className="text-sm text-ink/70">From the family wallet, where it stays until you spend it. {goal.free.display} is free right now.</p>
          <label htmlFor="set-aside" className="block">
            <span className="text-sm font-semibold text-forest">Amount</span>
            <span className="mt-1 flex min-h-[44px] items-center rounded-xl border border-sand-dark bg-white px-3 focus-within:ring-2 focus-within:ring-terracotta/40">
              <span className="text-ink/60" aria-hidden>
                $
              </span>
              <input id="set-aside" inputMode="decimal" autoComplete="off" className="w-full bg-transparent py-2 pl-1 text-lg tabular-nums text-ink outline-none" value={dollars} onChange={(e) => setDollars(e.target.value)} placeholder="25" disabled={busy !== null} />
            </span>
          </label>
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => setMode("view")} disabled={busy !== null}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={busy !== null || !dollars.trim()}>
              {busy === "add" ? "Setting aside…" : "Set it aside"}
            </PrimaryButton>
          </div>
        </form>
      )}

      {mode === "edit" && (
        <section className={`${card} space-y-3`} aria-labelledby="edit-goal-heading">
          <h2 id="edit-goal-heading" className="text-xl text-forest">
            Change the goal
          </h2>
          <GoalForm
            kids={goal.kids}
            initial={{ title: goal.title, kind: goal.kind, kidId: goal.kidId, dollars: goal.targetDisplay.replace(/[$,]/g, ""), targetDate: goal.targetDate ?? "" }}
            submitLabel="Save the goal"
            busy={busy === "edit"}
            onCancel={() => setMode("view")}
            onSubmit={async (draft) => {
              const ok = await run("edit", () => updateGoal(goal.id, draft), "The goal is saved.");
              if (ok) setMode("view");
            }}
          />
        </section>
      )}

      {goal.contributions.length > 0 && (
        <section className={`${card} space-y-2`} aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-lg font-semibold text-forest">
            History
          </h2>
          <ul className="divide-y divide-sand-dark">
            {goal.contributions.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className={c.released ? "text-ink/50 line-through" : "text-ink"}>
                    {c.name} set aside {c.display}
                  </p>
                  <p className="text-xs text-ink/60">{c.whenLabel}</p>
                </div>
                {!c.released && (
                  <button type="button" disabled={busy !== null} onClick={() => run(`release:${c.id}`, () => releaseContribution(c.id), `${c.display} is free again.`)} className="shrink-0 text-xs font-semibold text-forest underline disabled:opacity-60">
                    {busy === `release:${c.id}` ? "Taking back…" : "Take back"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {mode === "view" && (
        <div className="flex justify-between text-sm">
          <button type="button" onClick={() => setMode("edit")} disabled={busy !== null} className="font-semibold text-forest underline disabled:opacity-60">
            Change the goal
          </button>
          <button type="button" onClick={() => setMode("stop")} disabled={busy !== null} className="text-ink/60 underline disabled:opacity-60">
            Stop saving for this goal
          </button>
        </div>
      )}

      {mode === "stop" && (
        <section className={`${card} space-y-3`} aria-labelledby="stop-goal-heading">
          <h2 id="stop-goal-heading" className="text-xl text-forest">
            Stop saving for {goal.title}?
          </h2>
          <p className="text-sm text-ink/70">
            {goal.progress.percent > 0 || goal.contributors.length > 0 ? `The ${goal.savedDisplay} set aside goes back to what is free in the family wallet. ` : "Nothing is set aside yet, so nothing moves. "}
            The goal moves to Closed goals on the Goals page, where you can reopen it.
          </p>
          <div className="flex gap-2">
            <div className="shrink-0">
              <SecondaryButton type="button" onClick={() => setMode("view")} disabled={busy !== null}>
                Keep saving
              </SecondaryButton>
            </div>
            <PrimaryButton
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                const ok = await run("archive", () => archiveGoal(goal.id));
                if (ok) router.push("/goals");
              }}
            >
              {busy === "archive" ? "Stopping…" : "Yes, stop saving"}
            </PrimaryButton>
          </div>
        </section>
      )}
    </div>
  );
}
