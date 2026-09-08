"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JAR_KEYS, setSplitPart, splitAmounts, validateSplit, type JarKey, type Split } from "@/lib/family/jars";
import { unitsToDisplay } from "@/lib/money/usdc";

export type SaveSplitResult = { ok: true } | { ok: false; error: string };

const JAR = {
  spend: { label: "Spend", emoji: "🛍️", accent: "accent-kid-orange", text: "text-kid-orange" },
  save: { label: "Save", emoji: "🎯", accent: "accent-kid-teal", text: "text-kid-blue" },
  share: { label: "Share", emoji: "💝", accent: "accent-kid-purple", text: "text-kid-purple" },
} as const;

const PRIMARY =
  "h-14 w-full rounded-2xl bg-kid-orange text-xl font-bold text-white transition-transform duration-150 ease-out active:translate-y-px disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none";
const QUIET = "inline-flex h-12 w-full items-center justify-center rounded-2xl text-lg font-semibold text-ink/60 hover:bg-white/60";

/**
 * The weekly split: three sliders that always add up to 100. Moving one
 * jar shares the rest between the other two, so the split is never broken.
 * Shows what each jar would get from the next allowance.
 */
export function SplitScreen({
  split: initial,
  allowanceDisplay,
  allowanceUnits,
  onSave,
}: {
  split: Split;
  allowanceDisplay: string;
  /** Next allowance in base units, as a string across the boundary. */
  allowanceUnits: string;
  onSave: (split: Split) => Promise<SaveSplitResult>;
}) {
  const router = useRouter();
  const [split, setSplit] = useState<Split>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const amounts = splitAmounts(BigInt(allowanceUnits), split);

  async function submit() {
    const check = validateSplit(split);
    if (!check.ok) {
      setMessage({ kind: "error", text: check.error });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await onSave(check.split);
      if (result.ok) {
        setMessage({ kind: "saved", text: "Saved. Your next allowance will split this way." });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.error });
      }
    } catch {
      setMessage({ kind: "error", text: "Couldn't save your split. Try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-[30px] font-semibold leading-9 text-kid-green">Split your allowance</h1>
        <p className="text-base text-ink/70">Your next allowance is {allowanceDisplay}. How do you want to split it?</p>
      </header>

      <ul className="space-y-4">
        {JAR_KEYS.map((key: JarKey) => (
          <li key={key} className="space-y-2 rounded-3xl bg-white px-5 py-4 ring-1 ring-sand-dark">
            <div className="flex items-center justify-between">
              <label htmlFor={`split-${key}`} className={`flex items-center gap-2 text-lg font-bold ${JAR[key].text}`}>
                <span aria-hidden="true">{JAR[key].emoji}</span> {JAR[key].label}
              </label>
              <p className="text-right">
                <span className="font-display text-[26px] font-semibold leading-8 tabular-nums text-ink">{split[key]}%</span>
                <span className="ml-2 text-sm font-medium tabular-nums text-ink/60">{unitsToDisplay(amounts[key])}</span>
              </p>
            </div>
            <input
              id={`split-${key}`}
              aria-label={JAR[key].label}
              type="range"
              min={0}
              max={100}
              step={5}
              value={split[key]}
              onChange={(e) => {
                setMessage(null);
                setSplit((current) => setSplitPart(current, key, Number(e.target.value)));
              }}
              className={`h-11 w-full cursor-pointer ${JAR[key].accent}`}
            />
          </li>
        ))}
      </ul>

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className="rounded-2xl bg-kid-sage/35 px-4 py-3 text-base text-ink">
          {message.text}
        </p>
      )}

      <div className="space-y-2">
        <button type="button" onClick={submit} disabled={saving} className={PRIMARY}>
          {saving ? "Saving…" : "That's my split"}
        </button>
        <Link href="/kid" className={QUIET}>
          Back home
        </Link>
      </div>
    </div>
  );
}
