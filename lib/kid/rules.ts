/**
 * What happens when a kid taps Send. Pure rules over the family's limits and
 * the kid's history: no chain, no database. The chain is the hard stop; this
 * is the warm, specific explanation before the send gets there.
 *
 * Money is USDC base units as bigint. Every message is written for the kid.
 * Days and weeks are in the family timezone; a week starts Monday 00:00.
 */

import { unitsToDisplay } from "@/lib/money/usdc";
import { fromLocal, localParts, sameLocalDay } from "@/lib/rules/tz";

export type ContactStatus = "active" | "requested" | "removed";

export type SendContactRule = {
  id: string;
  label: string;
  status: ContactStatus;
};

/** A guardian's yes: which contact, how much, and when they said it. */
export type ApprovedSend = { contactId: string; units: bigint; decidedAt: Date };

export type SendDecisionInput = {
  units: bigint;
  /** The contact the kid picked, or null when it isn't on the list at all. */
  contact: SendContactRule | null;
  dailyLimitUnits: bigint;
  sentTodayUnits: bigint;
  weeklyLimitUnits: bigint;
  sentThisWeekUnits: bigint;
  contactWeeklyUnits: bigint;
  contactSentThisWeekUnits: bigint;
  approvalThresholdUnits: bigint;
  /** The newest approved request for this kid, if any. */
  approvedRequest: ApprovedSend | null;
  now: Date;
  timeZone: string;
};

export type BlockReason = "bad_amount" | "not_on_list" | "over_daily_limit" | "over_weekly_limit" | "over_person_limit";

export type SendDecision = { kind: "ok" } | { kind: "needs_approval" } | { kind: "blocked"; reason: BlockReason; message: string };

/** What is left of a limit, never below zero. */
export function leftUnits(limitUnits: bigint, sentUnits: bigint): bigint {
  const left = limitUnits - sentUnits;
  return left > 0n ? left : 0n;
}

export function dailyLeftUnits(dailyLimitUnits: bigint, sentTodayUnits: bigint): bigint {
  return leftUnits(dailyLimitUnits, sentTodayUnits);
}

const blocked = (reason: BlockReason, message: string): SendDecision => ({ kind: "blocked", reason, message });

/**
 * In order: on the list, daily limit, weekly limit, this person's weekly
 * limit, then the approval threshold. A guardian's yes today for the same
 * person and amount turns "needs approval" into "ok".
 */
export function decideSend(input: SendDecisionInput): SendDecision {
  const { units, contact } = input;
  if (units <= 0n) return blocked("bad_amount", "Pick an amount above zero.");

  if (!contact || contact.status === "removed") return blocked("not_on_list", "That person isn't on your list yet. Ask a parent to add them.");
  if (contact.status === "requested") return blocked("not_on_list", `${contact.label} isn't on your list yet. A parent still needs to say yes.`);

  const dailyLeft = leftUnits(input.dailyLimitUnits, input.sentTodayUnits);
  if (units > dailyLeft) {
    return blocked(
      "over_daily_limit",
      dailyLeft > 0n ? `That's more than you can send today. You have ${unitsToDisplay(dailyLeft)} left.` : "You've sent all you can today. Tomorrow is a new day.",
    );
  }

  const weeklyLeft = leftUnits(input.weeklyLimitUnits, input.sentThisWeekUnits);
  if (units > weeklyLeft) {
    return blocked(
      "over_weekly_limit",
      weeklyLeft > 0n ? `That's more than you can send this week. You have ${unitsToDisplay(weeklyLeft)} left until Monday.` : "You've sent all you can this week. Monday is a fresh start.",
    );
  }

  const personLeft = leftUnits(input.contactWeeklyUnits, input.contactSentThisWeekUnits);
  if (units > personLeft) {
    return blocked(
      "over_person_limit",
      personLeft > 0n
        ? `That's more than you can send ${contact.label} this week. You have ${unitsToDisplay(personLeft)} left for them.`
        : `You've sent ${contact.label} all you can this week. More on Monday.`,
    );
  }

  if (units > input.approvalThresholdUnits) {
    const approved = input.approvedRequest;
    const covered = approved && approved.contactId === contact.id && approved.units === units && sameLocalDay(approved.decidedAt, input.now, input.timeZone);
    if (!covered) return { kind: "needs_approval" };
  }
  return { kind: "ok" };
}

// --- Day and week boundaries in the family timezone.

/** Local midnight today, as an instant. */
export function startOfDay(now: Date, timeZone: string): Date {
  const p = localParts(now, timeZone);
  return fromLocal({ year: p.year, month: p.month, day: p.day, hour: 0, minute: 0 }, timeZone);
}

/** Monday 00:00 of the current local week, as an instant. */
export function startOfWeek(now: Date, timeZone: string): Date {
  const p = localParts(now, timeZone);
  const daysSinceMonday = (p.weekday + 6) % 7;
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day - daysSinceMonday));
  return fromLocal({ year: monday.getUTCFullYear(), month: monday.getUTCMonth() + 1, day: monday.getUTCDate(), hour: 0, minute: 0 }, timeZone);
}

// --- Summing what the kid already sent, straight from `events` rows.

/** The columns of an `events` row these helpers read; bigint columns arrive as numbers. */
export type SentEventRow = {
  kind: string;
  amount_units: number | string | null;
  created_at: string;
  counterparty?: string | null;
};

/** Total of `sent` events at or after `since`, optionally only those to one counterparty address. */
export function sumSentSince(events: SentEventRow[], since: Date, counterparty?: string): bigint {
  let total = 0n;
  for (const e of events) {
    if (e.kind !== "sent" || e.amount_units == null) continue;
    if (new Date(e.created_at).getTime() < since.getTime()) continue;
    if (counterparty !== undefined && e.counterparty !== counterparty) continue;
    total += BigInt(e.amount_units);
  }
  return total;
}

export function sentTodayUnits(events: SentEventRow[], now: Date, timeZone: string): bigint {
  return sumSentSince(events, startOfDay(now, timeZone));
}

export function sentThisWeekUnits(events: SentEventRow[], now: Date, timeZone: string, counterparty?: string): bigint {
  return sumSentSince(events, startOfWeek(now, timeZone), counterparty);
}
