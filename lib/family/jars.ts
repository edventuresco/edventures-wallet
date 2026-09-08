/**
 * The three jars a kid's allowance lands in (spend / save / share) and the
 * one savings goal. Pure rules: the weekly split must be whole percentages
 * that add up to 100, and a goal is a short title, a curated emoji and a
 * dollar target. Money arithmetic lives here, never in a screen.
 */

import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";

export type JarKey = "spend" | "save" | "share";
export type Split = Record<JarKey, number>;

export const JAR_KEYS: readonly JarKey[] = ["spend", "save", "share"];

export const GOAL_EMOJI: readonly string[] = ["🎯", "🎧", "🚲", "📚", "🎮", "🧸", "⚽", "🎨", "🐠", "🎁"];

const TITLE_MAX = 40;
const DOLLARS_RE = /^\d+(?:\.\d{1,2})?$/;
const TARGET_MAX_UNITS = dollarsToUnits("10000");

export type SplitCheck = { ok: true; split: Split } | { ok: false; error: string };

export function validateSplit(input: Split): SplitCheck {
  for (const key of JAR_KEYS) {
    const v = input[key];
    if (!Number.isInteger(v) || v < 0 || v > 100) return { ok: false, error: "Each jar needs a whole number from 0 to 100." };
  }
  if (input.spend + input.save + input.share !== 100) return { ok: false, error: "The three jars need to add up to 100." };
  return { ok: true, split: { spend: input.spend, save: input.save, share: input.share } };
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Move one jar to `value` and share what is left between the other two in
 * proportion to where they were (evenly when both were empty). Always sums
 * to 100, so a slider can never leave the split broken.
 */
export function setSplitPart(current: Split, key: JarKey, value: number): Split {
  const v = clampPercent(value);
  const remainder = 100 - v;
  const [a, b] = JAR_KEYS.filter((k) => k !== key) as [JarKey, JarKey];
  const total = current[a] + current[b];
  const aValue = total === 0 ? Math.floor(remainder / 2) : Math.round((remainder * current[a]) / total);
  return { ...current, [key]: v, [a]: aValue, [b]: remainder - aValue } as Split;
}

/** How many base units each jar gets from an allowance under this split. Rounding dust stays in spend. */
export function splitAmounts(allowanceUnits: bigint, split: Split): Record<JarKey, bigint> {
  const save = (allowanceUnits * BigInt(split.save)) / 100n;
  const share = (allowanceUnits * BigInt(split.share)) / 100n;
  return { spend: allowanceUnits - save - share, save, share };
}

export type GoalInput = { title: string; emoji: string; dollars: string };
export type GoalCheck = { ok: true; goal: { title: string; emoji: string; targetUnits: bigint } } | { ok: false; error: string };

export function validateGoal(input: GoalInput): GoalCheck {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "Give your goal a name." };
  if (title.length > TITLE_MAX) return { ok: false, error: "That name is a bit long. Try a shorter one." };
  if (!GOAL_EMOJI.includes(input.emoji)) return { ok: false, error: "Pick one of the pictures." };
  const dollars = input.dollars.trim();
  if (!DOLLARS_RE.test(dollars)) return { ok: false, error: "Pick an amount, like 20 or 12.50." };
  const targetUnits = dollarsToUnits(dollars);
  if (targetUnits <= 0n) return { ok: false, error: "Pick an amount, like 20 or 12.50." };
  if (targetUnits > TARGET_MAX_UNITS) return { ok: false, error: "That's a big goal. Try $10,000 or less." };
  return { ok: true, goal: { title, emoji: input.emoji, targetUnits } };
}

export type GoalProgress = { percent: number; percentLabel: string; amountLabel: string };

/** Whole percent toward the target, capped at 100, with live text for the bar. */
export function goalProgress(saveUnits: bigint, targetUnits: bigint): GoalProgress {
  const percent = targetUnits > 0n ? Math.min(100, Number((saveUnits * 100n) / targetUnits)) : 0;
  return { percent, percentLabel: `${percent}%`, amountLabel: `${unitsToDisplay(saveUnits)} of ${unitsToDisplay(targetUnits)}` };
}
