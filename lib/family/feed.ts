/**
 * The family activity feed: `events` rows turned into lines a guardian
 * reads. Pure: rows in, items out. Sentences come from the row (they are
 * written for the family when the event happens); this adds the face, the
 * time in the family's day, the tone, and a proof link when there is a
 * signature.
 */

import type { KidRow } from "@/lib/rules/family";
import { avatarEmoji, dateTimeLabel } from "@/lib/rules/family";
import { clockLabel, localParts } from "@/lib/rules/tz";
import { explorerUrl } from "@/lib/solana/explorer";

export type FeedEventRow = {
  id: string;
  kid_id: string | null;
  kind: string;
  summary: string;
  signature: string | null;
  created_at: string;
};

export type FeedTone = "plain" | "blocked" | "allowance";

export type FeedItem = {
  id: string;
  kidName: string;
  kidEmoji: string;
  summary: string;
  /** "Today, 15:57" / "Yesterday, 09:00" / "Monday 7 Sep, 09:00" in family time. */
  whenLabel: string;
  tone: FeedTone;
  /** Explorer link for grown-ups, only when the event landed on-chain. */
  proofUrl?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function localDayNumber(instant: Date, timeZone: string): number {
  const p = localParts(instant, timeZone);
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / DAY_MS);
}

export function feedWhenLabel(instant: Date, now: Date, timeZone: string): string {
  const days = localDayNumber(now, timeZone) - localDayNumber(instant, timeZone);
  if (days <= 0) return `Today, ${clockLabel(instant, timeZone)}`;
  if (days === 1) return `Yesterday, ${clockLabel(instant, timeZone)}`;
  return dateTimeLabel(instant, timeZone);
}

/** Stops read in terracotta-dark, money landing in the jars in forest, the rest in ink. */
export function feedTone(kind: string): FeedTone {
  if (kind === "blocked" || kind === "shop_failed") return "blocked";
  if (kind === "allowance" || kind === "split") return "allowance";
  return "plain";
}

export type FeedOptions = {
  /** Who a row with no kid on it belongs to (the grown-up's own moves). Defaults to "Family". */
  ownerName?: string;
};

export function feedItemFrom(row: FeedEventRow, kids: KidRow[], now: Date, timeZone: string, opts: FeedOptions = {}): FeedItem {
  const kid = row.kid_id ? kids.find((k) => k.id === row.kid_id) : undefined;
  const face = row.kid_id
    ? kid
      ? { kidName: kid.name, kidEmoji: avatarEmoji(kid.avatar_id) }
      : { kidName: "A kid", kidEmoji: "🧒" }
    : opts.ownerName
      ? { kidName: opts.ownerName, kidEmoji: "🧑" }
      : { kidName: "Family", kidEmoji: "🏡" };
  return {
    id: row.id,
    ...face,
    summary: row.summary,
    whenLabel: feedWhenLabel(new Date(row.created_at), now, timeZone),
    tone: feedTone(row.kind),
    ...(row.signature ? { proofUrl: explorerUrl(row.signature, "tx") } : {}),
  };
}
