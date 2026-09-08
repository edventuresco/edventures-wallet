"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AmountPad } from "@/components/kid/send/AmountPad";
import { jarMoveSummary, jarSourceHint, type JarMoveKind } from "@/lib/family/jar-move";
import { GOAL_EMOJI, goalProgress, validateGoal, type GoalInput } from "@/lib/family/jars";
import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";

export type GoalView = { title: string; emoji: string; targetUnits: string };
export type SaveGoalResult = { ok: true } | { ok: false; error: string };
export type JarMoveOutcome = { ok: true; explorerUrl?: string } | { ok: false; message: string };
export type JarMoveHandler = (from: JarMoveKind, to: JarMoveKind, dollars: string) => Promise<JarMoveOutcome>;

const PRIMARY =
  "h-14 w-full rounded-2xl bg-kid-orange text-xl font-bold text-white transition-transform duration-150 ease-out active:translate-y-px disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none";
const QUIET = "inline-flex h-12 w-full items-center justify-center rounded-2xl text-lg font-semibold text-ink/60 hover:bg-white/60";
const INPUT =
  "h-14 w-full rounded-2xl border border-sand-dark bg-white px-4 text-lg text-ink outline-none focus:ring-4 focus:ring-kid-orange/40";

type MoveState =
  | { kind: "amount" }
  | { kind: "moving"; dollars: string }
  | { kind: "done"; dollars: string }
  | { kind: "blocked"; message: string };

/** Kid-palette progress: teal fill on a sand track, live text beside it. */
function KidProgress({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={label}
        className="h-4 w-full overflow-hidden rounded-full bg-sand-dark"
      >
        <div className="h-full rounded-full bg-kid-teal transition-[width] duration-[350ms] ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-center text-sm font-semibold tabular-nums text-ink/70">{label}</p>
    </div>
  );
}

/** The same gentle check-draw as a send, with the jar's own sentence. */
function JarDone({ sentence, onBack }: { sentence: string; onBack: () => void }) {
  return (
    <section className="space-y-6">
      <div className="flex animate-leaf-lift flex-col items-center gap-5 rounded-3xl bg-kid-teal/15 px-6 py-10 text-center ring-1 ring-kid-teal/30 motion-reduce:animate-none">
        <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="48" r="44" fill="var(--color-white, #fffdf8)" stroke="var(--color-kid-teal)" strokeWidth="4" />
          <path d="M28 50 L42 63 L68 35" fill="none" stroke="var(--color-kid-teal)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="animate-check-draw motion-reduce:animate-none" />
        </svg>
        <p className="font-display text-[30px] font-semibold leading-9 text-kid-green tabular-nums">{sentence}</p>
      </div>
      <button type="button" onClick={onBack} className={PRIMARY}>
        Back to my jar
      </button>
    </section>
  );
}

/**
 * The savings jar: one goal per kid. Shows how far the save jar has come,
 * lets the kid add to it from their spend money or take some back, and
 * has a small form to pick or change the goal (name, picture, target).
 */
export function GoalScreen({
  saveDisplay,
  saveUnits,
  spendDisplay = "$0.00",
  spendUnits = "0",
  goal,
  onSave,
  onMove,
}: {
  saveDisplay: string;
  /** Save-jar balance in base units, as a string across the boundary. */
  saveUnits: string;
  spendDisplay?: string;
  /** Spend balance in base units, as a string across the boundary. */
  spendUnits?: string;
  goal: GoalView | null;
  onSave: (input: GoalInput) => Promise<SaveGoalResult>;
  /** Moves money between the kid's jars; the buttons show only when this is wired. */
  onMove?: JarMoveHandler;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(goal === null);
  const [title, setTitle] = useState(goal?.title ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? GOAL_EMOJI[0]);
  const [dollars, setDollars] = useState(goal ? unitsToDisplay(BigInt(goal.targetUnits)).replace(/[$,]/g, "") : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [move, setMove] = useState<{ from: JarMoveKind; to: JarMoveKind; state: MoveState } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = { title, emoji, dollars };
    const check = validateGoal(input);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await onSave(input);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Couldn't save your goal. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function runMove(from: JarMoveKind, to: JarMoveKind, amount: string) {
    if (!onMove) return;
    setMove({ from, to, state: { kind: "moving", dollars: amount } });
    let outcome: JarMoveOutcome;
    try {
      outcome = await onMove(from, to, amount);
    } catch {
      outcome = { ok: false, message: "That didn't go through, and nothing moved. Try again in a moment." };
    }
    setMove({ from, to, state: outcome.ok ? { kind: "done", dollars: amount } : { kind: "blocked", message: outcome.message } });
  }

  function backToJar() {
    setMove(null);
    router.refresh();
  }

  if (move) {
    const sourceDisplay = move.from === "spend" ? spendDisplay : saveDisplay;
    const sourceUnits = BigInt(move.from === "spend" ? spendUnits : saveUnits);
    switch (move.state.kind) {
      case "amount":
        return (
          <AmountPad
            title={move.from === "spend" ? "How much for your jar?" : "How much to take back?"}
            hint={jarSourceHint(move.from, sourceDisplay)}
            maxUnits={sourceUnits}
            onBack={() => setMove(null)}
            onConfirm={(amount) => runMove(move.from, move.to, amount)}
          />
        );
      case "moving":
        return (
          <section className="space-y-4 rounded-3xl bg-white px-6 py-10 text-center ring-1 ring-sand-dark" aria-live="polite">
            <p className="font-display text-[26px] font-semibold leading-8 text-kid-green">
              {move.from === "spend" ? `Putting ${unitsToDisplay(dollarsToUnits(move.state.dollars))} in your jar…` : `Taking ${unitsToDisplay(dollarsToUnits(move.state.dollars))} back…`}
            </p>
            <p className="text-base text-ink/60">Just a moment.</p>
          </section>
        );
      case "done":
        return <JarDone sentence={`${jarMoveSummary(move.from, dollarsToUnits(move.state.dollars))}.`} onBack={backToJar} />;
      case "blocked":
        return (
          <section className="space-y-6" aria-live="polite">
            <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-8 text-center ring-1 ring-sand-dark">
              <span aria-hidden="true" className="text-5xl leading-none">
                🦉
              </span>
              <h1 className="font-display text-[26px] font-semibold leading-8 text-kid-green">Not this time</h1>
              <p className="max-w-xs text-lg leading-7 text-ink">{move.state.message}</p>
            </div>
            <button type="button" onClick={() => setMove(null)} className={PRIMARY}>
              Okay
            </button>
          </section>
        );
    }
  }

  if (editing) {
    return (
      <form onSubmit={submit} className="space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-[30px] font-semibold leading-9 text-kid-green">{goal ? "Change your goal" : "What are you saving for?"}</h1>
          <p className="text-base text-ink/70">Your save jar has {saveDisplay}. Pick something to aim for.</p>
        </header>

        <div className="space-y-2">
          <label htmlFor="goal-title" className="text-sm font-semibold text-ink/70">
            Goal name
          </label>
          <input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="Headphones" className={INPUT} />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink/70">Pick a picture</legend>
          <div role="radiogroup" aria-label="Pick a picture" className="grid grid-cols-5 gap-2">
            {GOAL_EMOJI.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={emoji === option}
                aria-label={option}
                onClick={() => setEmoji(option)}
                className={`flex h-14 items-center justify-center rounded-2xl text-3xl transition-transform duration-150 ease-out active:scale-95 motion-reduce:transition-none ${
                  emoji === option ? "bg-kid-sun ring-4 ring-kid-orange/60" : "bg-white ring-1 ring-sand-dark"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <label htmlFor="goal-dollars" className="text-sm font-semibold text-ink/70">
            How much?
          </label>
          <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-ink/50">
              $
            </span>
            <input id="goal-dollars" inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value)} placeholder="20" className={`${INPUT} pl-8 tabular-nums`} />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-white px-4 py-3 text-base text-ink ring-1 ring-sand-dark">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <button type="submit" disabled={saving} className={PRIMARY}>
            {saving ? "Saving…" : "Save my goal"}
          </button>
          {goal ? (
            <button type="button" onClick={() => setEditing(false)} className={QUIET}>
              Not now
            </button>
          ) : (
            <Link href="/kid" className={QUIET}>
              Back home
            </Link>
          )}
        </div>
      </form>
    );
  }

  const progress = goal ? goalProgress(BigInt(saveUnits), BigInt(goal.targetUnits)) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-[30px] font-semibold leading-9 text-kid-green">Your save jar</h1>
        <p className="text-base text-ink/70">Money in here waits for something bigger.</p>
      </header>

      <section className="space-y-5 rounded-3xl bg-kid-teal/15 px-6 py-7 text-center ring-1 ring-kid-teal/30">
        {goal && (
          <>
            <span aria-hidden="true" className="block text-6xl leading-none">
              {goal.emoji}
            </span>
            <h2 className="font-display text-[26px] font-semibold leading-8 text-ink">{goal.title}</h2>
          </>
        )}
        <p className="font-display text-[48px] font-semibold leading-none tabular-nums text-ink">{saveDisplay}</p>
        {progress && <KidProgress percent={progress.percent} label={progress.amountLabel} />}
        {progress && progress.percent >= 100 && <p className="text-base font-semibold text-kid-green">You made it. Ask a grown-up what happens next.</p>}
      </section>

      <div className="space-y-2">
        {onMove ? (
          <>
            <button type="button" onClick={() => setMove({ from: "spend", to: "save", state: { kind: "amount" } })} className={PRIMARY}>
              Add to goal
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMove({ from: "save", to: "spend", state: { kind: "amount" } })} className={QUIET}>
                Take back
              </button>
              <button type="button" onClick={() => setEditing(true)} className={QUIET}>
                Change my goal
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className={PRIMARY}>
            Change my goal
          </button>
        )}
        <Link href="/kid" className={QUIET}>
          Back home
        </Link>
      </div>
    </div>
  );
}
