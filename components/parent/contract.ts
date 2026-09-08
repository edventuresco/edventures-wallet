/**
 * Component contract for the parent app.
 *
 * Every parent screen renders from these types and calls the server actions
 * in app/parent/actions.ts. Build against lib/mock/family.ts while the
 * backend lands. If a screen needs a field that is not here, add it here
 * first and to the fixture, then use it.
 */

import type { MoneyView } from "@/lib/money/usdc";

export type KidId = string;
export type ContactId = string;
export type RequestId = string;

export type AgeBand = "6-8" | "9-11" | "12+";

/** The profile-icon set kids choose from. Assets land in public/icons/profile/. */
export type ProfileIcon =
  | "sloth"
  | "puppy"
  | "fox"
  | "panda"
  | "koala"
  | "owl"
  | "otter"
  | "bunny";

export type ContactView = {
  id: ContactId;
  label: string;
  icon: ProfileIcon | "parent" | "person";
  weeklyLimit: MoneyView;
  status: "active" | "requested" | "removed";
  /** True once the rule is live on-chain; screens show "updating" until then. */
  onchainSynced: boolean;
};

export type RuleSummary = {
  /** Ceiling on what the kid can send per day across everyone. Parent-editable. */
  dailyLimit: MoneyView;
  /** What the kid has sent so far today, against dailyLimit. */
  sentToday: MoneyView;
  /** Sum of the per-person weekly limits. */
  weeklyTotal: MoneyView;
  people: ContactView[];
  apps: string[];
  /** Plain-language lines, e.g. "Can send to Mum, Sister, Grandma". */
  lines: string[];
};

export type AllowanceView = {
  amount: MoneyView;
  cadence: "weekly";
  nextRunISO: string;
};

export type EventView = {
  id: string;
  kidId: KidId;
  kind: "allowance" | "sent" | "received" | "blocked" | "saved" | "badge";
  /** Kid-language sentence, e.g. "Mum sent you $5.00 for allowance". */
  summary: string;
  amount?: MoneyView;
  occurredAtISO: string;
  explorerUrl?: string;
};

export type KidSummary = {
  id: KidId;
  name: string;
  icon: ProfileIcon;
  ageBand: AgeBand;
  balance: MoneyView;
  savings?: { balance: MoneyView; goalTitle: string; goalTarget: MoneyView };
  allowance: AllowanceView;
  rules: RuleSummary;
  lastEvent?: EventView;
};

export type RequestView = {
  id: RequestId;
  kidId: KidId;
  kidName: string;
  type: "add_contact" | "extra_money" | "unlock_app";
  summary: string;
  createdAtISO: string;
  status: "pending" | "approved" | "declined";
};

export type FamilyOverviewProps = {
  familyName: string;
  kids: KidSummary[];
  pendingRequests: RequestView[];
};

export type ActionResult = { ok: true; mock?: boolean } | { ok: false; error: string };

/** Emoji stand-ins until the drawn icon set lands. */
export const PROFILE_ICON_EMOJI: Record<ProfileIcon, string> = {
  sloth: "🦥",
  puppy: "🐶",
  fox: "🦊",
  panda: "🐼",
  koala: "🐨",
  owl: "🦉",
  otter: "🦦",
  bunny: "🐰",
};
