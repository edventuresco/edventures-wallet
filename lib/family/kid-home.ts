/**
 * The kid home screen's view model. Pure: rows in, ready-to-render strings
 * out. Money stays in USDC base units until it becomes a display string;
 * the one bigint the screen still needs (today's remaining limit, for the
 * Send flow) crosses to the client as a decimal string.
 */

import type { SendContact } from "@/components/kid/send/ContactGrid";
import { unitsToDisplay } from "@/lib/money/usdc";
import { localParts, sameLocalDay } from "@/lib/rules/tz";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const RECENT_LIMIT = 5;

export type KidHomeInput = {
  now: Date;
  timeZone: string;
  kid: { id: string; name: string; avatar_id: string; owl_name: string | null };
  jars: Record<"spend" | "save" | "share", bigint>;
  dailyLimitUnits: bigint;
  contacts: Array<{ id: string; label: string; avatar_id: string; address: string; weekly_limit_units: number; status: string }>;
  allowance: { amount_units: number; next_run_at: string } | null;
  /** This kid's events, any order; newest first is not assumed. */
  events: Array<{ id: string; kind: string; amount_units: number | null; counterparty: string | null; summary: string; reason?: string | null; created_at: string }>;
};

export type KidHomeView = {
  /** owlNamed is false until the kid has picked a name; owlName is then the default "Owl". */
  kid: { id: string; name: string; avatarId: string; owlName: string; owlNamed: boolean };
  /** The newest blocked event's reason, for the owl to explain "why didn't that work". */
  lastBlockedReason?: string;
  /** How the kid refers to their guardian, from the parent contact: "Mum" or "Guardian". */
  parentLabel: string;
  jars: Record<"spend" | "save" | "share", string>;
  allowance: { amountDisplay: string; whenLabel: string } | null;
  /** Base units as a decimal string so it survives the server → client boundary. */
  dailyLeftUnits: string;
  dailyLeftDisplay: string;
  contacts: SendContact[];
  recent: Array<{ id: string; summary: string; whenLabel: string }>;
};

function max0(units: bigint): bigint {
  return units < 0n ? 0n : units;
}

function localDayNumber(instant: Date, timeZone: string): number {
  const p = localParts(instant, timeZone);
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / DAY_MS);
}

/** "Allowance today" / "Allowance tomorrow" / "Allowance in 4 days", by calendar days in the family timezone. */
export function allowanceWhenLabel(nextRunAt: Date, now: Date, timeZone: string): string {
  const days = localDayNumber(nextRunAt, timeZone) - localDayNumber(now, timeZone);
  if (days <= 0) return "Allowance today";
  if (days === 1) return "Allowance tomorrow";
  return `Allowance in ${days} days`;
}

/** "Today", "Yesterday", the weekday within the last week, or a short date beyond that. */
export function dayLabel(instant: Date, now: Date, timeZone: string): string {
  const days = localDayNumber(now, timeZone) - localDayNumber(instant, timeZone);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long" }).format(instant);
  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" }).format(instant);
}

export function buildKidHomeView(input: KidHomeInput): KidHomeView {
  const { now, timeZone } = input;
  const sent = input.events.filter((e) => e.kind === "sent" && e.amount_units != null);

  const sentToday = sent
    .filter((e) => sameLocalDay(new Date(e.created_at), now, timeZone))
    .reduce((sum, e) => sum + BigInt(e.amount_units ?? 0), 0n);
  const dailyLeft = max0(input.dailyLimitUnits - sentToday);

  const weekAgo = now.getTime() - WEEK_MS;
  const sentThisWeekTo = (address: string) =>
    sent
      .filter((e) => e.counterparty === address && new Date(e.created_at).getTime() > weekAgo)
      .reduce((sum, e) => sum + BigInt(e.amount_units ?? 0), 0n);

  const active = input.contacts.filter((c) => c.status === "active");
  const parent = active.find((c) => c.avatar_id === "parent");

  const newestFirst = [...input.events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const recent = newestFirst
    .slice(0, RECENT_LIMIT)
    .map((e) => ({ id: e.id, summary: e.summary, whenLabel: dayLabel(new Date(e.created_at), now, timeZone) }));
  const lastBlocked = newestFirst.find((e) => e.kind === "blocked");
  const owlName = input.kid.owl_name?.trim() ?? "";

  return {
    kid: { id: input.kid.id, name: input.kid.name, avatarId: input.kid.avatar_id, owlName: owlName || "Owl", owlNamed: owlName.length > 0 },
    lastBlockedReason: lastBlocked ? lastBlocked.reason?.trim() || lastBlocked.summary : undefined,
    parentLabel: parent?.label ?? "Mum",
    jars: {
      spend: unitsToDisplay(input.jars.spend),
      save: unitsToDisplay(input.jars.save),
      share: unitsToDisplay(input.jars.share),
    },
    allowance: input.allowance
      ? {
          amountDisplay: unitsToDisplay(BigInt(input.allowance.amount_units)),
          whenLabel: allowanceWhenLabel(new Date(input.allowance.next_run_at), now, timeZone),
        }
      : null,
    dailyLeftUnits: dailyLeft.toString(),
    dailyLeftDisplay: unitsToDisplay(dailyLeft),
    contacts: active.map((c) => ({
      id: c.id,
      label: c.label,
      avatarId: c.avatar_id,
      weeklyLeftDisplay: `${unitsToDisplay(max0(BigInt(c.weekly_limit_units) - sentThisWeekTo(c.address)))} left this week`,
    })),
    recent,
  };
}
