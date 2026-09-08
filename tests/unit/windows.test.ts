import { describe, expect, it } from "vitest";
import { SLOT_MS_FLOOR, WEEK_MS, slotsFor, spendWindowSlots } from "@/lib/swig/windows";

describe("slot windows", () => {
  it("converts a duration to a slot count, rounding up", () => {
    expect(slotsFor(WEEK_MS, 400)).toBe(1_512_000n);
    expect(slotsFor(WEEK_MS, 200)).toBe(3_024_000n);
    expect(slotsFor(1001, 1000)).toBe(2n);
  });

  it("sizes spend windows for the 200 ms floor so caps never reset early", () => {
    expect(SLOT_MS_FLOOR).toBe(200);
    // Measured 350 ms today: still size for 200 ms (more slots, longer real window).
    expect(spendWindowSlots(WEEK_MS, 350)).toBe(3_024_000n);
    // A measurement below the floor is trusted as-is.
    expect(spendWindowSlots(WEEK_MS, 150)).toBe(slotsFor(WEEK_MS, 150));
  });

  it("rejects nonsense inputs", () => {
    expect(() => slotsFor(0, 400)).toThrow();
    expect(() => slotsFor(WEEK_MS, 0)).toThrow();
  });
});
