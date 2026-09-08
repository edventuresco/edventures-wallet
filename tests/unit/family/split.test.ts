import { describe, expect, it } from "vitest";
import { dollarsToUnits } from "@/lib/money/usdc";
import { splitSummary, splitUnits } from "@/lib/family/split";

const DEFAULT = { spend: 50, save: 40, share: 10 };

describe("splitUnits", () => {
  it("splits $10 as $5 / $4 / $1 with the default percentages", () => {
    expect(splitUnits(dollarsToUnits("10"), DEFAULT)).toEqual({ spend: 5_000_000n, save: 4_000_000n, share: 1_000_000n });
  });

  it("is exact in base units: the parts always add up to the amount", () => {
    const amounts = [0n, 1n, 2n, 3n, 7n, 99n, 1_000_001n, 12_345_678n, dollarsToUnits("7.77"), dollarsToUnits("1234.56")];
    const splits = [DEFAULT, { spend: 33, save: 33, share: 34 }, { spend: 1, save: 1, share: 98 }, { spend: 0, save: 100, share: 0 }];
    for (const amount of amounts) {
      for (const pct of splits) {
        const parts = splitUnits(amount, pct);
        expect(parts.spend + parts.save + parts.share).toBe(amount);
        expect(parts.spend).toBeGreaterThanOrEqual(0n);
        expect(parts.save).toBeGreaterThanOrEqual(0n);
        expect(parts.share).toBeGreaterThanOrEqual(0n);
      }
    }
  });

  it("sends the remainder to spend, never rounding save or share up", () => {
    // 1_000_001 × 33% = 330_000.33 and × 34% = 340_000.34: both floor, spend takes the leftover.
    expect(splitUnits(1_000_001n, { spend: 33, save: 33, share: 34 })).toEqual({ spend: 330_001n, save: 330_000n, share: 340_000n });
    // One unit cannot be shared: it all goes to spend.
    expect(splitUnits(1n, DEFAULT)).toEqual({ spend: 1n, save: 0n, share: 0n });
  });

  it("handles a jar at 0% and a jar at 100%", () => {
    expect(splitUnits(dollarsToUnits("3"), { spend: 100, save: 0, share: 0 })).toEqual({ spend: 3_000_000n, save: 0n, share: 0n });
    expect(splitUnits(dollarsToUnits("3"), { spend: 0, save: 0, share: 100 })).toEqual({ spend: 0n, save: 0n, share: 3_000_000n });
  });

  it("rejects percentages that do not sum to 100, fractions, and negative amounts", () => {
    expect(() => splitUnits(1_000_000n, { spend: 50, save: 40, share: 20 })).toThrow(/sum to 100/);
    expect(() => splitUnits(1_000_000n, { spend: 50.5, save: 39.5, share: 10 })).toThrow(/whole number/);
    expect(() => splitUnits(1_000_000n, { spend: 110, save: -10, share: 0 })).toThrow(/whole number/);
    expect(() => splitUnits(-1n, DEFAULT)).toThrow(/negative/);
  });
});

describe("splitSummary", () => {
  it("reads as one line for the events feed", () => {
    expect(splitSummary(splitUnits(dollarsToUnits("10"), DEFAULT))).toBe("Split: $5.00 spend, $4.00 save, $1.00 share");
  });
});
