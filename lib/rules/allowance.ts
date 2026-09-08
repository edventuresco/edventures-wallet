import { dollarsToUnits } from "@/lib/money/usdc";
import { fromLocal, localParts } from "./tz";

/**
 * Allowance defaults and schedule. A kid's allowance defaults to their age
 * in dollars a week, paid Monday morning in the family timezone.
 */

export const ALLOWANCE_HOUR = 9;
const MONDAY = 1;

/** Whole years old, from month and year of birth (the day is never captured). */
export function ageFromBirth(month: number | null, year: number | null, now: Date): number | null {
  if (month == null || year == null) return null;
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth() + 1;
  return nowYear - year - (nowMonth < month ? 1 : 0);
}

/** Age in dollars, at least $1; $5 when we do not know the age. */
export function defaultAllowanceUnits(age: number | null): bigint {
  if (age == null) return dollarsToUnits("5");
  return dollarsToUnits(String(Math.max(1, Math.floor(age))));
}

/** The coming Monday at 09:00 family time (today, if it is Monday and 09:00 has not passed). */
export function nextMondayAt(now: Date, timeZone: string): Date {
  const today = localParts(now, timeZone);
  let daysAhead = (MONDAY - today.weekday + 7) % 7;
  const candidate = fromLocal({ ...shiftDays(today, daysAhead), hour: ALLOWANCE_HOUR, minute: 0 }, timeZone);
  if (candidate.getTime() <= now.getTime()) daysAhead += 7;
  return fromLocal({ ...shiftDays(today, daysAhead), hour: ALLOWANCE_HOUR, minute: 0 }, timeZone);
}

function shiftDays(parts: { year: number; month: number; day: number }, days: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
