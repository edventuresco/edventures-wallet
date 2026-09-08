/**
 * Money is USDC base units: integers with 6 decimals. Never floats.
 * Screens receive `MoneyView.display`; only lib code does arithmetic.
 */

export const USDC_DECIMALS = 6;
export const UNITS_PER_DOLLAR = 1_000_000n;

export type MoneyView = {
  /** USDC base units as a JS number (safe well past any family wallet). */
  units: number;
  /** Ready to render, e.g. "$2.50". */
  display: string;
};

const DOLLAR_INPUT = /^(\d+)(?:\.(\d{1,6}))?$/;

/** Parse "2", "2.5", "$2.50", "1,000.25" into base units. Throws on bad input. */
export function dollarsToUnits(input: string | number): bigint {
  const raw = String(input).trim().replace(/^\$/, "").replace(/,/g, "");
  const match = DOLLAR_INPUT.exec(raw);
  if (!match) {
    throw new Error(`Not a dollar amount: "${input}"`);
  }
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(USDC_DECIMALS, "0"));
  return whole * UNITS_PER_DOLLAR + fraction;
}

/** "$2.50" from base units. Cents are truncated, never rounded up. */
export function unitsToDisplay(units: bigint | number): string {
  const value = BigInt(units);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const dollars = abs / UNITS_PER_DOLLAR;
  const cents = (abs % UNITS_PER_DOLLAR) / 10_000n;
  const body = `${dollars.toLocaleString("en-US")}.${cents.toString().padStart(2, "0")}`;
  return `${negative ? "-" : ""}$${body}`;
}

export function toView(units: bigint | number): MoneyView {
  return { units: Number(units), display: unitsToDisplay(units) };
}
