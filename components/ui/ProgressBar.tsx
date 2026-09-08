"use client";

import { useEffect, useState } from "react";

/**
 * A 10-12px rounded progress track (spec: "ProgressBar"). Color never
 * stands alone: `valueLabel` (e.g. "61%" or "$3,680 of $6,000") is always
 * rendered as live text next to the bar. The fill animates from 0 to
 * `value` once on mount over 350ms ease-out, and skips the animation
 * under `prefers-reduced-motion`.
 */
export type ProgressBarProps = {
  /** 0-100. Values outside this range are clamped. */
  value: number;
  /** Live text describing the value; always rendered, animation or not. */
  valueLabel: string;
  className?: string;
};

export function ProgressBar({ value, valueLabel, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={valueLabel}
        className="h-3 w-full overflow-hidden rounded-full bg-sand-dark"
      >
        <div
          className="h-full rounded-full bg-terracotta transition-[width] duration-[350ms] ease-out motion-reduce:transition-none"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-1.5 text-sm font-medium text-ink/70">{valueLabel}</p>
    </div>
  );
}
