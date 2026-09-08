/**
 * Swap arithmetic, all integers. USDC is 6 decimals (base units), SOL is 9
 * (lamports). A price is USDC base units per whole SOL, so $150.25 is
 * 150_250_000n. Never floats; displays are strings.
 */
import { dollarsToUnits, unitsToDisplay, UNITS_PER_DOLLAR } from "@/lib/money/usdc";

export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const SOL_MINT = "So11111111111111111111111111111111111111112";

export type SwapDirection = "usdc_to_sol" | "sol_to_usdc";

const SOL_INPUT = /^(\d+)(?:\.(\d{1,9}))?$/;

/** Parse "0.5", "1", "2.25" SOL into lamports. Throws on bad input. */
export function solToLamports(input: string | number): bigint {
  const raw = String(input).trim().replace(/,/g, "");
  const match = SOL_INPUT.exec(raw);
  if (!match) throw new Error(`Not a SOL amount: "${input}"`);
  return BigInt(match[1]) * LAMPORTS_PER_SOL + BigInt((match[2] ?? "").padEnd(9, "0"));
}

/** "0.5000 SOL" from lamports: four decimals, truncated. */
export function lamportsToDisplay(lamports: bigint | number): string {
  const value = BigInt(lamports);
  const whole = value / LAMPORTS_PER_SOL;
  const frac = ((value % LAMPORTS_PER_SOL) / 100_000n).toString().padStart(4, "0");
  return `${whole.toLocaleString("en-US")}.${frac} SOL`;
}

/** Parse a "150" or "150.25" dollar price into USDC base units per SOL. */
export function priceFromDollars(input: string | number): bigint {
  const units = dollarsToUnits(input);
  if (units <= 0n) throw new Error("A price must be above zero");
  return units;
}

/** How many lamports `usdcUnits` buys at `priceUnitsPerSol`, rounded down. */
export function lamportsFor(usdcUnits: bigint, priceUnitsPerSol: bigint): bigint {
  return (usdcUnits * LAMPORTS_PER_SOL) / priceUnitsPerSol;
}

/** How many USDC base units `lamports` is worth at `priceUnitsPerSol`, rounded down. */
export function usdcFor(lamports: bigint, priceUnitsPerSol: bigint): bigint {
  return (lamports * priceUnitsPerSol) / LAMPORTS_PER_SOL;
}

/** "1 SOL = $150.25" for the screen. */
export function rateLabel(priceUnitsPerSol: bigint): string {
  return `1 SOL = ${unitsToDisplay(priceUnitsPerSol)}`;
}

/** The effective price implied by a quote, USDC units per SOL, for the rate line; 0n when either side is empty. */
export function impliedPrice(usdcUnits: bigint, lamports: bigint): bigint {
  if (usdcUnits <= 0n || lamports <= 0n) return 0n;
  return (usdcUnits * LAMPORTS_PER_SOL) / lamports;
}

/** What each side is called in copy. */
export function sideLabels(direction: SwapDirection): { from: string; to: string } {
  return direction === "usdc_to_sol" ? { from: "USDC", to: "SOL" } : { from: "SOL", to: "USDC" };
}

export { UNITS_PER_DOLLAR };
