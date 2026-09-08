"use client";

import { useState } from "react";
import { PrimaryButton, RuleNotice, SecondaryButton } from "@/components/family/ui";
import { GOAL_KIND_META, GOAL_KINDS, GOAL_TITLE_MAX, validateGoalDraft, type GoalDraft, type GoalKind } from "@/lib/family/goals";

const field = "mt-1 block min-h-[44px] w-full rounded-xl border border-sand-dark bg-white px-3 py-2 text-lg text-ink outline-none focus:ring-2 focus:ring-terracotta/40 disabled:opacity-60";
const chip = (selected: boolean) => `cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold ${selected ? "border-terracotta bg-terracotta/10 text-terracotta-dark" : "border-sand-dark text-ink"}`;

export type GoalFormProps = {
  initial?: Partial<GoalDraft>;
  kids: Array<{ id: string; name: string }>;
  submitLabel: string;
  busy: boolean;
  onSubmit: (draft: GoalDraft) => void;
  onCancel?: () => void;
};

/** Start or change a goal: a name, what kind it is, whose it is, a target, and an optional date. */
export function GoalForm({ initial, kids, submitLabel, busy, onSubmit, onCancel }: GoalFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState<GoalKind>(initial?.kind ?? "trip");
  const [kidId, setKidId] = useState<string>(initial?.kidId ?? "");
  const [dollars, setDollars] = useState(initial?.dollars ?? "");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const draft: GoalDraft = { title, kind, kidId: kidId || null, dollars, targetDate };
        const check = validateGoalDraft(draft, new Date());
        if (!check.ok) return setError(check.error);
        setError(null);
        onSubmit(draft);
      }}
    >
      <label htmlFor="goal-title" className="block">
        <span className="text-sm font-semibold text-forest">What are you saving for?</span>
        <input id="goal-title" className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={GOAL_TITLE_MAX} placeholder="Japan together" autoComplete="off" disabled={busy} />
      </label>

      <fieldset>
        <legend className="text-sm font-semibold text-forest">What kind of goal</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {GOAL_KINDS.map((k) => (
            <label key={k} className={chip(kind === k)}>
              <input type="radio" name="goal-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" disabled={busy} />
              <span aria-hidden>{GOAL_KIND_META[k].emoji} </span>
              {GOAL_KIND_META[k].label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-forest">Whose goal</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          <label className={chip(kidId === "")}>
            <input type="radio" name="goal-for" value="" checked={kidId === ""} onChange={() => setKidId("")} className="sr-only" disabled={busy} />
            Everyone
          </label>
          {kids.map((k) => (
            <label key={k.id} className={chip(kidId === k.id)}>
              <input type="radio" name="goal-for" value={k.id} checked={kidId === k.id} onChange={() => setKidId(k.id)} className="sr-only" disabled={busy} />
              {k.name}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="goal-target" className="block">
        <span className="text-sm font-semibold text-forest">Target</span>
        <span className="mt-1 flex min-h-[44px] items-center rounded-xl border border-sand-dark bg-white px-3 focus-within:ring-2 focus-within:ring-terracotta/40">
          <span className="text-ink/60" aria-hidden>
            $
          </span>
          <input id="goal-target" inputMode="decimal" autoComplete="off" className="w-full bg-transparent py-2 pl-1 text-lg tabular-nums text-ink outline-none" value={dollars} onChange={(e) => setDollars(e.target.value)} placeholder="6000" disabled={busy} />
        </span>
      </label>

      <label htmlFor="goal-date" className="block">
        <span className="text-sm font-semibold text-forest">By when</span>
        <span className="block text-xs text-ink/60">Optional.</span>
        <input id="goal-date" type="date" className={field} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} disabled={busy} />
      </label>

      {error && <RuleNotice tone="problem">{error}</RuleNotice>}
      <div className="flex gap-2">
        {onCancel && (
          <SecondaryButton type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </SecondaryButton>
        )}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </PrimaryButton>
      </div>
    </form>
  );
}
