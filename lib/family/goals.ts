/**
 * Family goals: sub-savings accounts for trips, activities and other things
 * the family saves toward together. Pure rules; the screens and actions
 * call these and never restate them.
 *
 * A goal's money is set aside, not moved. Every contribution earmarks part
 * of its contributor's own balance, so "saved" is the sum of unreleased
 * contributions and a guardian can only set aside what the family wallet
 * holds beyond what is already earmarked.
 */

import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";
import { goalProgress, type GoalProgress } from "./jars";

export const GOAL_KINDS = ["trip", "activity", "other"] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export function isGoalKind(value: unknown): value is GoalKind {
  return GOAL_KINDS.includes(value as GoalKind);
}

export const GOAL_KIND_META: Record<GoalKind, { label: string; emoji: string; art: string | null; blurb: string }> = {
  trip: { label: "A trip", emoji: "✈️", art: "/illustrations/japan-goal-vignette.png", blurb: "Experiences build a richer kind of wealth." },
  activity: { label: "An activity", emoji: "🎟️", art: "/illustrations/family-path-wallet.png", blurb: "Good people, further together." },
  other: { label: "Something else", emoji: "🎯", art: null, blurb: "Different contributions. Same direction." },
};

export const GOAL_TITLE_MAX = 40;
const DOLLARS_RE = /^\d+(?:\.\d{1,2})?$/;
const TARGET_MAX_UNITS = dollarsToUnits("100000");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type GoalDraft = {
  title: string;
  kind: GoalKind;
  /** Dollars as typed, e.g. "6000" or "250.50". */
  dollars: string;
  /** ISO date (YYYY-MM-DD) or empty for no date. */
  targetDate: string;
  /** Null: everyone's goal. */
  kidId: string | null;
};

export type GoalDraftCheck =
  | { ok: true; goal: { title: string; kind: GoalKind; emoji: string; targetUnits: bigint; targetDate: string | null; kidId: string | null } }
  | { ok: false; error: string };

/** A short title, a known kind, a dollar target up to $100,000, and an optional date that is not in the past. */
export function validateGoalDraft(draft: GoalDraft, now: Date): GoalDraftCheck {
  const title = (draft.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "Give the goal a name." };
  if (title.length > GOAL_TITLE_MAX) return { ok: false, error: `Keep the name to ${GOAL_TITLE_MAX} characters.` };
  if (!isGoalKind(draft.kind)) return { ok: false, error: "Pick what kind of goal this is." };
  const dollars = (draft.dollars ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  if (!DOLLARS_RE.test(dollars)) return { ok: false, error: "Pick a target, like 500 or 6000." };
  const targetUnits = dollarsToUnits(dollars);
  if (targetUnits <= 0n) return { ok: false, error: "Pick a target above zero." };
  if (targetUnits > TARGET_MAX_UNITS) return { ok: false, error: "That's a big goal. Try $100,000 or less." };
  const date = (draft.targetDate ?? "").trim();
  let targetDate: string | null = null;
  if (date) {
    if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, error: "That date doesn't look right." };
    if (date < now.toISOString().slice(0, 10)) return { ok: false, error: "Pick a date that hasn't passed." };
    targetDate = date;
  }
  return { ok: true, goal: { title, kind: draft.kind, emoji: GOAL_KIND_META[draft.kind].emoji, targetUnits, targetDate, kidId: draft.kidId || null } };
}

export type Contribution = {
  id: string;
  /** Who set it aside: a guardian (userId) or a kid (kidId). */
  userId: string | null;
  kidId: string | null;
  name: string;
  units: bigint;
  releasedAt: string | null;
  createdAt: string;
};

export type ContributorShare = {
  /** "user:<id>" or "kid:<id>". */
  key: string;
  name: string;
  units: bigint;
  display: string;
  /** Whole percent of what is saved so far, e.g. 79. */
  percent: number;
  percentLabel: string;
};

export type GoalSummary = {
  savedUnits: bigint;
  savedDisplay: string;
  progress: GoalProgress;
  /** Largest first. Only unreleased contributions count. */
  contributors: ContributorShare[];
};

/** What is saved, how far that is toward the target, and who put in what. */
export function goalSummary(contributions: Contribution[], targetUnits: bigint): GoalSummary {
  const live = contributions.filter((c) => !c.releasedAt);
  const savedUnits = live.reduce((sum, c) => sum + c.units, 0n);
  const byKey = new Map<string, ContributorShare>();
  for (const c of live) {
    const key = c.kidId ? `kid:${c.kidId}` : `user:${c.userId}`;
    const existing = byKey.get(key);
    const units = (existing?.units ?? 0n) + c.units;
    byKey.set(key, { key, name: c.name, units, display: unitsToDisplay(units), percent: 0, percentLabel: "0%" });
  }
  const contributors = [...byKey.values()]
    .map((c) => {
      const percent = savedUnits > 0n ? Number((c.units * 100n) / savedUnits) : 0;
      return { ...c, percent, percentLabel: `${percent}%` };
    })
    .sort((a, b) => (a.units === b.units ? a.name.localeCompare(b.name) : a.units > b.units ? -1 : 1));
  return { savedUnits, savedDisplay: unitsToDisplay(savedUnits), progress: goalProgress(savedUnits, targetUnits), contributors };
}

/** What a guardian may still set aside: the family wallet beyond what is already earmarked, never below zero. */
export function setAsideAvailable(input: { familyWalletUnits: bigint; earmarkedUnits: bigint }): bigint {
  const free = input.familyWalletUnits - input.earmarkedUnits;
  return free > 0n ? free : 0n;
}

export type SetAsideCheck = { ok: true; units: bigint } | { ok: false; error: string };

export function validateSetAside(dollars: string, availableUnits: bigint): SetAsideCheck {
  const raw = (dollars ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  if (!DOLLARS_RE.test(raw)) return { ok: false, error: "Pick an amount, like 20 or 12.50." };
  const units = dollarsToUnits(raw);
  if (units <= 0n) return { ok: false, error: "Pick an amount above zero." };
  if (units > availableUnits) {
    return { ok: false, error: availableUnits > 0n ? `The family wallet has ${unitsToDisplay(availableUnits)} free right now. Try a smaller amount.` : "Nothing in the family wallet is free to set aside right now." };
  }
  return { ok: true, units };
}

/** "Family goal" or "Mia's goal". */
export function goalOwnerLabel(kidName: string | null): string {
  if (!kidName) return "Family goal";
  return `${kidName}${/s$/i.test(kidName) ? "'" : "'s"} goal`;
}

/** "12 Dec 2026" in a timezone. Newer ICU spells September "Sept"; every month stays three letters here. */
function dayLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(instant).replace("Sept", "Sep");
}

/** "By 12 Dec 2026", or null with no date. */
export function targetDateLabel(targetDate: string | null): string | null {
  if (!targetDate) return null;
  const d = new Date(`${targetDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return `By ${dayLabel(d, "UTC")}`;
}

/** "Closed 8 Sep 2026", the day in the family's timezone. */
export function closedLabel(archivedAt: string, timeZone: string): string {
  return `Closed ${dayLabel(new Date(archivedAt), timeZone)}`;
}
