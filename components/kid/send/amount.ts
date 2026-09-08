/**
 * Number-pad rules for the kid Send flow. The pad keeps a raw string of
 * what the kid has typed ("2.5"); everything money-shaped goes through
 * lib/money/usdc so no dollar arithmetic happens here.
 */

import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";

export type PadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "delete";

export const MAX_WHOLE_DIGITS = 4;
export const MAX_DECIMALS = 2;

/** Apply one key press to the raw typed string. Never produces leading zeros or a second dot. */
export function pressKey(raw: string, key: PadKey): string {
  if (key === "delete") {
    return raw.slice(0, -1);
  }
  if (key === ".") {
    if (raw.includes(".")) return raw;
    return raw === "" ? "0." : `${raw}.`;
  }
  const [whole, decimals] = raw.split(".");
  if (decimals !== undefined) {
    return decimals.length >= MAX_DECIMALS ? raw : `${raw}${key}`;
  }
  if (whole === "" || whole === "0") {
    return key === "0" ? "" : key;
  }
  return whole.length >= MAX_WHOLE_DIGITS ? raw : `${raw}${key}`;
}

/** "2.5" → "2.50", "2." → "2.00", "" → "0.00". Always two decimals, never a float. */
export function normaliseDollars(raw: string): string {
  const [whole, decimals = ""] = raw.split(".");
  return `${whole === "" ? "0" : whole}.${decimals.padEnd(MAX_DECIMALS, "0")}`;
}

export function rawToUnits(raw: string): bigint {
  return dollarsToUnits(normaliseDollars(raw));
}

/** Live display for the pad, e.g. "$2.50". */
export function rawToDisplay(raw: string): string {
  return unitsToDisplay(rawToUnits(raw));
}
