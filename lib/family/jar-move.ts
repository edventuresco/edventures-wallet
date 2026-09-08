/**
 * Moving money between the kid's own jars: spend → save ("Add to goal")
 * and save → spend ("Take back"). No contact rules, no approval: the
 * on-chain role already allows both directions (lib/family/roles.ts), so
 * the only checks are the direction, the amount and what the jar holds.
 * Share is a donation jar and goes through the approval path instead.
 */

import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";

export type JarMoveKind = "spend" | "save";
export type JarMoveInput = { from: JarMoveKind; to: JarMoveKind; dollars: string };
export type JarMove = { from: JarMoveKind; to: JarMoveKind; units: bigint };
export type JarMoveCheck = { ok: true; move: JarMove } | { ok: false; message: string };

const DOLLARS_RE = /^\d+(?:\.\d{1,2})?$/;
const JARS: readonly JarMoveKind[] = ["spend", "save"];

export const ERR_JAR_AMOUNT = "That amount doesn't look right. Try typing it again.";
export const ERR_JAR_DIRECTION = "Money can only move between your spend money and your jar.";

export function validateJarMove(input: JarMoveInput): JarMoveCheck {
  if (!JARS.includes(input.from) || !JARS.includes(input.to) || input.from === input.to) return { ok: false, message: ERR_JAR_DIRECTION };
  const dollars = input.dollars.trim();
  if (!DOLLARS_RE.test(dollars)) return { ok: false, message: ERR_JAR_AMOUNT };
  const units = dollarsToUnits(dollars);
  if (units <= 0n) return { ok: false, message: ERR_JAR_AMOUNT };
  return { ok: true, move: { from: input.from, to: input.to, units } };
}

/** Is there enough in the source jar? Says what is there in the kid's words when not. */
export function checkJarBalance(input: { from: JarMoveKind; units: bigint; balanceUnits: bigint }): { ok: true } | { ok: false; message: string } {
  if (input.balanceUnits >= input.units) return { ok: true };
  if (input.from === "save") {
    return { ok: false, message: input.balanceUnits > 0n ? `Your jar has ${unitsToDisplay(input.balanceUnits)} right now. Try a smaller amount.` : "Your jar is empty right now." };
  }
  return {
    ok: false,
    message: input.balanceUnits > 0n ? `You have ${unitsToDisplay(input.balanceUnits)} to spend right now. Try a smaller amount.` : "You have nothing to spend right now.",
  };
}

/** The sentence written to `events` and shown when the move lands. */
export function jarMoveSummary(from: JarMoveKind, units: bigint): string {
  return from === "spend" ? `Put ${unitsToDisplay(units)} in your jar` : `Took ${unitsToDisplay(units)} back from your jar`;
}

/** Above the number pad: what the source jar holds, so the kid picks an amount that fits. */
export function jarSourceHint(from: JarMoveKind, balanceDisplay: string): string {
  return from === "spend" ? `You have ${balanceDisplay} to spend` : `Your jar has ${balanceDisplay}`;
}
