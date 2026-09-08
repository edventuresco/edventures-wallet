import { unitsToDisplay } from "@/lib/money/usdc";

/**
 * How an allowance lands in a kid's three jars. Pure, exact in base units:
 * save and share are floored, and every leftover unit goes to spend, so the
 * three parts always add up to the amount paid.
 */

export type SplitPct = { spend: number; save: number; share: number };
export type SplitUnits = { spend: bigint; save: bigint; share: bigint };

export const JAR_KINDS = ["spend", "save", "share"] as const;

export function splitUnits(amount: bigint, pct: SplitPct): SplitUnits {
  if (amount < 0n) throw new Error(`splitUnits: amount must not be negative (got ${amount})`);
  for (const jar of JAR_KINDS) {
    if (!Number.isInteger(pct[jar]) || pct[jar] < 0 || pct[jar] > 100) throw new Error(`splitUnits: ${jar} must be a whole number from 0 to 100 (got ${pct[jar]})`);
  }
  if (pct.spend + pct.save + pct.share !== 100) throw new Error(`splitUnits: percentages must sum to 100 (got ${pct.spend + pct.save + pct.share})`);
  const save = (amount * BigInt(pct.save)) / 100n;
  const share = (amount * BigInt(pct.share)) / 100n;
  return { spend: amount - save - share, save, share };
}

/** "Split: $5.00 spend, $4.00 save, $1.00 share" for the events feed. */
export function splitSummary(split: SplitUnits): string {
  return `Split: ${unitsToDisplay(split.spend)} spend, ${unitsToDisplay(split.save)} save, ${unitsToDisplay(split.share)} share`;
}
