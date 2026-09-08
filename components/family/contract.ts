/**
 * Props for the guardian "Rules" and "Allowance" screens. Pages build these
 * from Supabase in the actions.ts next to each page; components render them and call
 * the actions. Money arrives as ready-to-render `MoneyView`s.
 */

import type { MoneyView } from "@/lib/money/usdc";
import type { LimitField } from "@/lib/rules/limits";

export type { LimitField };

export type ContactRuleView = {
  id: string;
  label: string;
  /** Emoji stand-in for the avatar. */
  emoji: string;
  weeklyLimit: MoneyView;
  status: "active" | "requested" | "removed";
  onchainSynced: boolean;
};

export type MemberRulesView = {
  /** null = the guardian's own wallet. */
  kidId: string | null;
  kind: "kid" | "guardian";
  name: string;
  emoji: string;
  dailyLimit: MoneyView;
  /** Kids only; the guardian's own wallet has no weekly total. */
  weeklyLimit: MoneyView | null;
  /** Kids only: sends above this wait for the guardian. */
  approvalThreshold: MoneyView | null;
  /** A raise waiting its four hours, if any. */
  pending: { field: LimitField; amount: MoneyView; label: string } | null;
  onchainSynced: boolean;
  /** Kids only: true once a paired device holds a role on-chain, so rules can be pushed there. */
  hasDevice: boolean;
  contacts: ContactRuleView[];
};

export type RulesScreenProps = {
  familyName: string;
  timezone: string;
  members: MemberRulesView[];
};

export type RuleChange =
  | { kind: "limit"; kidId: string | null; field: LimitField; dollars: string }
  | { kind: "contact"; contactId: string; dollars: string };

export type SaveRulesResult = { ok: true; notices: string[] } | { ok: false; error: string };

export type KidAllowanceView = {
  id: string;
  name: string;
  emoji: string;
  age: number | null;
  amount: MoneyView;
  /** True while no allowance row exists and the amount shown is the age default. */
  isDefault: boolean;
  cadence: "weekly";
  nextRunISO: string;
  /** "Monday 14 Sep, 09:00" in family time. */
  nextRunLabel: string;
  lastPaidLabel: string | null;
};

export type AllowanceScreenProps = {
  familyName: string;
  timezone: string;
  kids: KidAllowanceView[];
  /** True once the keeper role is on the family wallet, so allowances can be paid (now or on Monday). */
  keeperEnabled: boolean;
  /** The most the keeper may move a week, for the "turn on" copy. */
  keeperWeeklyCap: MoneyView;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

/** A server-built transaction for this device to sign, and the token that binds the two. */
export type PreparedTx = { ok: true; token: string; txBase64: string; summary: string } | { ok: false; error: string };
export type SentTxResult = { ok: true; explorerUrl: string } | { ok: false; error: string };

export type PreparedRuleSync = PreparedTx;
export type RuleSyncResult = SentTxResult;
export type PreparedKeeperRole = PreparedTx;
export type KeeperRoleResult = SentTxResult;

export const FIELD_LABELS: Record<LimitField, string> = {
  daily_limit_units: "Daily limit",
  weekly_limit_units: "Weekly limit",
  approval_threshold_units: "Approval threshold",
};

/** One kid's ask to send more than their threshold, for the guardian's inbox. */
export type RequestView = {
  id: string;
  /** A send over the threshold, a share from the share jar (approval every time), or a kid asking to add someone. */
  type: "approve_send" | "share" | "add_contact";
  kidName: string;
  kidEmoji: string;
  contactLabel: string;
  /** Null for an add_contact ask. */
  amount: MoneyView | null;
  status: "pending" | "approved" | "declined" | "used";
  /** "Asked at 14:30" / "Approved at 15:02", in family time. */
  whenLabel: string;
};

export type RequestsScreenProps = {
  familyName: string;
  pending: RequestView[];
  /** Decided today, newest first. */
  decided: RequestView[];
};
/** What the guardian fills in to put someone on a kid's list. */
export type AddContactInput = { kidId: string; label: string; avatarId: string; address: string; weeklyDollars: string };
