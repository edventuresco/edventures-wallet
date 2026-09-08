import { describe, expect, it } from "vitest";
import { DEFAULTS, ageFromBirth, defaultAllowanceUnits, nextMondayAt } from "@/lib/family/defaults";

describe("family defaults", () => {
  it("computes whole years of age from month and year", () => {
    const now = new Date("2026-09-07T00:00:00Z");
    expect(ageFromBirth(3, 2016, now)).toBe(10);
    expect(ageFromBirth(11, 2016, now)).toBe(9);
    expect(ageFromBirth(9, 2018, now)).toBe(8);
  });

  it("allowance is age dollars a week, at least $1", () => {
    expect(defaultAllowanceUnits(10)).toBe(10_000_000n);
    expect(defaultAllowanceUnits(0)).toBe(1_000_000n);
  });

  it("finds the coming Monday 09:00 in Kuching", () => {
    // Monday 2026-09-07 13:30 Kuching → next Monday 2026-09-14 09:00 (+08:00)
    expect(nextMondayAt(new Date("2026-09-07T05:30:00Z"), DEFAULTS.timezone).toISOString()).toBe("2026-09-14T01:00:00.000Z");
    // Sunday 2026-09-06 → Monday 2026-09-07 09:00
    expect(nextMondayAt(new Date("2026-09-06T05:30:00Z"), DEFAULTS.timezone).toISOString()).toBe("2026-09-07T01:00:00.000Z");
  });


  it("split defaults sum to 100", () => {
    expect(DEFAULTS.split.spend + DEFAULTS.split.save + DEFAULTS.split.share).toBe(100);
  });
});
