import { describe, expect, it } from "vitest";
import { familyTotalUnits, kidsTotalUnits } from "@/lib/family/balances";

describe("family balances", () => {
  it("adds the family wallet and every kid's three jars", () => {
    const kids = [
      { spend: 2_000_000n, save: 4_000_000n, share: 1_000_000n },
      { spend: 1_000_000n, save: 0n, share: 0n },
    ];
    expect(kidsTotalUnits(kids)).toBe(8_000_000n);
    expect(familyTotalUnits(24_500_000n, kids)).toBe(32_500_000n);
    expect(familyTotalUnits(0n, [])).toBe(0n);
  });
});
