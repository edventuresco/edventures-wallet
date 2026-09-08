"use client";

import { useState } from "react";
import { normaliseDollars, pressKey, rawToDisplay, rawToUnits, type PadKey } from "./amount";

const KEYS: PadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "delete"];
const QUICK = ["1", "2", "5"] as const;

const KEY_CLASS =
  "flex h-16 items-center justify-center rounded-full bg-white text-[28px] font-semibold text-ink shadow-[0_2px_0_0_var(--color-sand-dark)] transition-transform duration-150 ease-out tabular-nums select-none active:translate-y-0.5 active:scale-95 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none motion-reduce:active:scale-100";

/**
 * Step two of Send: a big number pad. Dollars only, two decimals, no
 * leading zeros. Hands back a normalised string like "2.50"; the flow turns
 * that into base units with lib/money.
 */
export function AmountPad({
  onConfirm,
  onBack,
  initial = "",
  title = "How much?",
  hint,
  maxUnits,
}: {
  onConfirm: (dollars: string) => void;
  onBack?: () => void;
  /** Raw string to start from, e.g. when the kid comes back from the confirm card. */
  initial?: string;
  title?: string;
  /** Plain-language limit line, e.g. "You can send up to $23.00 today". */
  hint?: string;
  /** When set, amounts above this hold the Next button and explain why. */
  maxUnits?: bigint;
}) {
  const [raw, setRaw] = useState(initial);
  const units = rawToUnits(raw);
  const over = maxUnits !== undefined && units > maxUnits;
  const canConfirm = units > 0n && !over;

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex size-11 items-center justify-center rounded-full text-2xl text-kid-green hover:bg-white/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50"
          >
            ←
          </button>
        )}
        <h1 className="font-display text-[30px] font-semibold leading-9 text-kid-green">{title}</h1>
      </header>

      <div className="rounded-3xl bg-kid-sun px-6 py-7 text-center">
        <p
          data-testid="amount-display"
          aria-live="polite"
          className={`font-display text-[56px] font-semibold leading-none tabular-nums ${units === 0n ? "text-ink/45" : "text-ink"}`}
        >
          {rawToDisplay(raw)}
        </p>
        {(hint || over) && (
          <p className="mt-3 text-sm font-medium leading-5 text-ink/70" aria-live="polite">
            {over ? `That's more than today's limit. ${hint ?? ""}`.trim() : hint}
          </p>
        )}
      </div>

      <div className="flex justify-center gap-3" aria-label="Quick amounts">
        {QUICK.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setRaw(amount)}
            className="min-w-[72px] rounded-full bg-kid-teal px-5 py-3 text-lg font-bold text-white transition-transform duration-150 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none"
          >
            ${amount}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3" role="group" aria-label="Number pad">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-label={key === "delete" ? "Delete" : key}
            onClick={() => setRaw((current) => pressKey(current, key))}
            className={KEY_CLASS}
          >
            {key === "delete" ? <span aria-hidden="true">⌫</span> : key}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!canConfirm}
        onClick={() => onConfirm(normaliseDollars(raw))}
        className="h-14 w-full rounded-2xl bg-kid-orange text-xl font-bold text-white transition-[transform,opacity] duration-150 ease-out active:translate-y-px disabled:cursor-default disabled:opacity-45 disabled:active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none"
      >
        Next
      </button>
    </section>
  );
}
