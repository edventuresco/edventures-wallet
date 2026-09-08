import { describe, expect, it } from "vitest";
import { GOAL_EMOJI, goalProgress, setSplitPart, validateGoal, validateSplit } from "@/lib/family/jars";
import { dollarsToUnits } from "@/lib/money/usdc";

describe("validateSplit", () => {
  it("accepts whole percentages that sum to 100", () => {
    expect(validateSplit({ spend: 50, save: 40, share: 10 })).toEqual({ ok: true, split: { spend: 50, save: 40, share: 10 } });
    expect(validateSplit({ spend: 100, save: 0, share: 0 }).ok).toBe(true);
  });

  it("rejects sums that are not 100, negatives and fractions", () => {
    expect(validateSplit({ spend: 50, save: 40, share: 5 }).ok).toBe(false);
    expect(validateSplit({ spend: 110, save: -10, share: 0 }).ok).toBe(false);
    expect(validateSplit({ spend: 50.5, save: 39.5, share: 10 }).ok).toBe(false);
  });
});

describe("setSplitPart", () => {
  it("moves one jar and rebalances the other two in proportion, always summing to 100", () => {
    expect(setSplitPart({ spend: 50, save: 40, share: 10 }, "spend", 30)).toEqual({ spend: 30, save: 56, share: 14 });
    expect(setSplitPart({ spend: 50, save: 40, share: 10 }, "save", 60)).toEqual({ spend: 33, save: 60, share: 7 });
  });

  it("splits evenly when the other two are both zero", () => {
    expect(setSplitPart({ spend: 100, save: 0, share: 0 }, "spend", 80)).toEqual({ spend: 80, save: 10, share: 10 });
  });

  it("clamps to 0..100", () => {
    expect(setSplitPart({ spend: 50, save: 40, share: 10 }, "share", 130)).toEqual({ spend: 0, save: 0, share: 100 });
    expect(setSplitPart({ spend: 50, save: 40, share: 10 }, "share", -5).share).toBe(0);
  });
});

describe("validateGoal", () => {
  it("accepts a short title, a curated emoji and a dollar target", () => {
    expect(validateGoal({ title: "  Headphones ", emoji: "🎧", dollars: "40" })).toEqual({
      ok: true,
      goal: { title: "Headphones", emoji: "🎧", targetUnits: dollarsToUnits("40") },
    });
  });

  it("rejects an empty or long title, an unknown emoji, and a zero, huge or malformed target", () => {
    expect(validateGoal({ title: "", emoji: "🎧", dollars: "40" }).ok).toBe(false);
    expect(validateGoal({ title: "x".repeat(41), emoji: "🎧", dollars: "40" }).ok).toBe(false);
    expect(validateGoal({ title: "Bike", emoji: "💣", dollars: "40" }).ok).toBe(false);
    expect(validateGoal({ title: "Bike", emoji: "🎧", dollars: "0" }).ok).toBe(false);
    expect(validateGoal({ title: "Bike", emoji: "🎧", dollars: "10001" }).ok).toBe(false);
    expect(validateGoal({ title: "Bike", emoji: "🎧", dollars: "4.5.6" }).ok).toBe(false);
  });

  it("offers a curated emoji set", () => {
    expect(GOAL_EMOJI.length).toBeGreaterThanOrEqual(8);
    expect(GOAL_EMOJI).toContain("🎯");
  });
});

describe("goalProgress", () => {
  it("reports a whole percent and live labels, capped at 100", () => {
    expect(goalProgress(dollarsToUnits("12"), dollarsToUnits("40"))).toEqual({ percent: 30, percentLabel: "30%", amountLabel: "$12.00 of $40.00" });
    expect(goalProgress(dollarsToUnits("50"), dollarsToUnits("40")).percent).toBe(100);
    expect(goalProgress(dollarsToUnits("1"), 0n).percent).toBe(0);
  });
});
