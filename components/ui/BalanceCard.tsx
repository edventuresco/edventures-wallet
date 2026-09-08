"use client";

import { useState } from "react";

/**
 * Forest-surface balance card (spec: "BalanceCard"). White primary value in
 * tabular numerals, sand secondary label. The hide/reveal control keeps its
 * own state and also reports changes via `onReveal`, so a parent screen can
 * mirror a persistent balance-privacy setting (spec section 7).
 */
export type BalanceCardProps = {
  /** e.g. "Family balance". */
  label: string;
  /** Ready-to-render display string, e.g. "$8,420.16". Never compute money here. */
  value: string;
  /** Optional supporting line under the value. */
  hint?: string;
  /** Called with the new revealed state whenever the hide/reveal control is toggled. */
  onReveal?: (revealed: boolean) => void;
  className?: string;
};

export function BalanceCard({ label, value, hint, onReveal, className }: BalanceCardProps) {
  const [revealed, setRevealed] = useState(true);

  function toggle() {
    const next = !revealed;
    setRevealed(next);
    onReveal?.(next);
  }

  return (
    <section
      className={`rounded-[22px] border border-sand-dark bg-forest p-6 shadow-[0_8px_28px_rgba(34,31,26,0.08)] ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-sand/80">{label}</p>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={!revealed}
          className="rounded-full px-2 py-1.5 text-xs font-semibold text-sand/80 underline decoration-sand/40 underline-offset-2 hover:text-white"
        >
          {revealed ? "Hide" : "Show"}
          <span className="sr-only"> balance</span>
        </button>
      </div>

      <p className="mt-2 text-[36px]/[40px] font-bold tabular-nums text-white">
        {revealed ? value : "••••••"}
      </p>

      {hint && <p className="mt-1 text-sm text-sand/70">{hint}</p>}
    </section>
  );
}
