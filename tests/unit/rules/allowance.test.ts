import { describe, expect, it } from "vitest";
import { dollarsToUnits } from "@/lib/money/usdc";
import { ageFromBirth, defaultAllowanceUnits, nextMondayAt } from "@/lib/rules/allowance";

describe("ageFromBirth", () => {
  const now = new Date("2026-09-07T06:30:00Z");

  it("counts whole years once the birth month has come round", () => {
    expect(ageFromBirth(3, 2016, now)).toBe(10);
    expect(ageFromBirth(9, 2016, now)).toBe(10);
  });

  it("is one less before the birth month this year", () => {
    expect(ageFromBirth(12, 2016, now)).toBe(9);
  });

  it("is null when the birth date is unknown", () => {
    expect(ageFromBirth(null, null, now)).toBeNull();
    expect(ageFromBirth(3, null, now)).toBeNull();
  });
});

describe("defaultAllowanceUnits", () => {
  it("is the kid's age in dollars", () => {
    expect(defaultAllowanceUnits(10)).toBe(dollarsToUnits("10"));
  });

  it("never goes below $1", () => {
    expect(defaultAllowanceUnits(0)).toBe(dollarsToUnits("1"));
  });

  it("is $5 when the age is unknown", () => {
    expect(defaultAllowanceUnits(null)).toBe(dollarsToUnits("5"));
  });
});

describe("nextMondayAt", () => {
  it("is the coming Monday at 09:00 family time", () => {
    const sundayNoon = new Date("2026-09-06T04:00:00Z"); // Sun 12:00 Kuching
    expect(nextMondayAt(sundayNoon, "Asia/Kuching").toISOString()).toBe("2026-09-07T01:00:00.000Z");
  });

  it("is today when it is Monday before 09:00", () => {
    const mondayEarly = new Date("2026-09-07T00:00:00Z"); // Mon 08:00 Kuching
    expect(nextMondayAt(mondayEarly, "Asia/Kuching").toISOString()).toBe("2026-09-07T01:00:00.000Z");
  });

  it("rolls to next week once Monday 09:00 has passed", () => {
    const mondayLate = new Date("2026-09-07T02:00:00Z"); // Mon 10:00 Kuching
    expect(nextMondayAt(mondayLate, "Asia/Kuching").toISOString()).toBe("2026-09-14T01:00:00.000Z");
  });

  it("uses the offset in force on the Monday, not today (DST change in between)", () => {
    const beforeFallBack = new Date("2026-11-01T00:00:00Z"); // Sat 20:00 New York, still EDT
    expect(nextMondayAt(beforeFallBack, "America/New_York").toISOString()).toBe("2026-11-02T14:00:00.000Z"); // 09:00 EST
  });
});
