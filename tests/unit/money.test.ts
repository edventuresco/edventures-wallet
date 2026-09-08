import { describe, expect, it } from "vitest";
import { dollarsToUnits, toView, unitsToDisplay } from "@/lib/money/usdc";

describe("dollarsToUnits", () => {
  it("parses whole dollars, cents, and a leading $", () => {
    expect(dollarsToUnits("2")).toBe(2_000_000n);
    expect(dollarsToUnits("2.5")).toBe(2_500_000n);
    expect(dollarsToUnits("$2.50")).toBe(2_500_000n);
    expect(dollarsToUnits("1,000.25")).toBe(1_000_250_000n);
    expect(dollarsToUnits(3)).toBe(3_000_000n);
  });

  it("rejects negatives, blanks, and more than six decimals", () => {
    expect(() => dollarsToUnits("-1")).toThrow();
    expect(() => dollarsToUnits("")).toThrow();
    expect(() => dollarsToUnits("1.1234567")).toThrow();
    expect(() => dollarsToUnits("abc")).toThrow();
  });
});

describe("unitsToDisplay", () => {
  it("formats with two decimals and truncates sub-cent units", () => {
    expect(unitsToDisplay(2_500_000n)).toBe("$2.50");
    expect(unitsToDisplay(0n)).toBe("$0.00");
    expect(unitsToDisplay(1_999_999n)).toBe("$1.99");
    expect(unitsToDisplay(1_234_567_890n)).toBe("$1,234.56");
    expect(unitsToDisplay(-500_000n)).toBe("-$0.50");
  });

  it("round-trips through toView", () => {
    const view = toView(dollarsToUnits("7.50"));
    expect(view).toEqual({ units: 7_500_000, display: "$7.50" });
  });
});
