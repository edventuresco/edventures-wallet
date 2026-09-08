import { describe, expect, it } from "vitest";
import { impliedPrice, lamportsFor, lamportsToDisplay, priceFromDollars, rateLabel, sideLabels, solToLamports, usdcFor } from "@/lib/swap/amounts";

describe("swap amounts", () => {
  it("parses SOL and shows lamports with four decimals, truncated", () => {
    expect(solToLamports("1")).toBe(1_000_000_000n);
    expect(solToLamports("0.5")).toBe(500_000_000n);
    expect(solToLamports("0.123456789")).toBe(123_456_789n);
    expect(() => solToLamports("abc")).toThrow();
    expect(lamportsToDisplay(1_234_567_890n)).toBe("1.2345 SOL");
    expect(lamportsToDisplay(0n)).toBe("0.0000 SOL");
  });

  it("converts both ways at a price in USDC units per SOL, rounding down", () => {
    const price = priceFromDollars("150");
    expect(price).toBe(150_000_000n);
    expect(lamportsFor(15_000_000n, price)).toBe(100_000_000n); // $15 → 0.1 SOL
    expect(usdcFor(100_000_000n, price)).toBe(15_000_000n); // 0.1 SOL → $15
    expect(lamportsFor(1n, price)).toBe(6n); // a dust amount rounds down, never up
    expect(() => priceFromDollars("0")).toThrow();
  });

  it("labels the rate and the sides, and reads a price back out of a quote", () => {
    expect(rateLabel(150_250_000n)).toBe("1 SOL = $150.25");
    expect(sideLabels("usdc_to_sol")).toEqual({ from: "USDC", to: "SOL" });
    expect(sideLabels("sol_to_usdc")).toEqual({ from: "SOL", to: "USDC" });
    expect(impliedPrice(15_000_000n, 100_000_000n)).toBe(150_000_000n);
    expect(impliedPrice(0n, 1n)).toBe(0n);
  });
});
