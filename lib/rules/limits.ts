import { DEFAULTS } from "@/lib/family/defaults";
import { clockLabel, sameLocalDay } from "./tz";

/**
 * Spending limits for one family member (a kid, or the guardian's own
 * wallet). Pure logic over the `limits` table row: lowering a limit applies
 * at once; raising one waits four hours so a stolen phone cannot lift the
 * ceiling and drain the wallet in one go.
 *
 * Money is USDC base units as bigint. Screens never see these values raw.
 */

export const RAISE_DELAY_MS: number = DEFAULTS.raiseDelayMs;

export type LimitField = "daily_limit_units" | "weekly_limit_units" | "approval_threshold_units";

export const LIMIT_FIELDS: readonly LimitField[] = ["daily_limit_units", "weekly_limit_units", "approval_threshold_units"];

export type PendingRaise = {
  field: LimitField;
  units: bigint;
  effective_at: Date;
};

export type LimitRow = {
  daily_limit_units: bigint;
  weekly_limit_units: bigint;
  approval_threshold_units: bigint;
  pending_raise: PendingRaise | null;
};

export type MemberKind = "kid" | "guardian";

/** Working defaults from the Sept 7 Q&A (lib/family/defaults); every one is guardian-editable. */
export function defaultLimits(kind: MemberKind): LimitRow {
  return {
    daily_limit_units: kind === "kid" ? DEFAULTS.kidDailyUnits : DEFAULTS.guardianDailyUnits,
    weekly_limit_units: kind === "kid" ? DEFAULTS.kidWeeklyUnits : DEFAULTS.guardianWeeklyUnits,
    approval_threshold_units: DEFAULTS.approvalThresholdUnits,
    pending_raise: null,
  };
}

/** Default weekly cap for one person on a kid's list. */
export const DEFAULT_CONTACT_WEEKLY_UNITS = DEFAULTS.perContactWeeklyUnits;

/** Apply a guardian's edit. Returns the row to store; never mutates `current`. */
export function applyLimitChange(current: LimitRow, field: LimitField, newUnits: bigint, now: Date): LimitRow {
  if (newUnits < 0n) throw new Error(`applyLimitChange: ${field} cannot be negative`);
  const live = current[field];
  const pendingOnField = current.pending_raise?.field === field ? current.pending_raise : null;

  if (newUnits === live) {
    // Re-entering the live value cancels a raise that was waiting on this field.
    return pendingOnField ? { ...current, pending_raise: null } : current;
  }
  if (newUnits < live) {
    return { ...current, [field]: newUnits, pending_raise: pendingOnField ? null : current.pending_raise };
  }
  return {
    ...current,
    pending_raise: { field, units: newUnits, effective_at: new Date(now.getTime() + RAISE_DELAY_MS) },
  };
}

/** Promote a pending raise whose time has come. `changed` tells the caller to write the row back. */
export function resolvePending(row: LimitRow, now: Date): { row: LimitRow; changed: boolean } {
  const pending = row.pending_raise;
  if (!pending || pending.effective_at.getTime() > now.getTime()) return { row, changed: false };
  return { row: { ...row, [pending.field]: pending.units, pending_raise: null }, changed: true };
}

/** "Applies at 18:30" / "Applies tomorrow at 02:30", in the family timezone. */
export function appliesAtLabel(effectiveAt: Date, now: Date, timeZone: string): string {
  const clock = clockLabel(effectiveAt, timeZone);
  return sameLocalDay(effectiveAt, now, timeZone) ? `Applies at ${clock}` : `Applies tomorrow at ${clock}`;
}

// --- Postgres row mapping. bigint columns arrive as JS numbers; the jsonb stores units as a number too.

export type LimitRowDb = {
  daily_limit_units: number;
  weekly_limit_units: number;
  approval_threshold_units: number;
  pending_raise: { field: LimitField; units: number; effective_at: string } | null;
};

export function limitRowFromDb(db: LimitRowDb): LimitRow {
  return {
    daily_limit_units: BigInt(db.daily_limit_units),
    weekly_limit_units: BigInt(db.weekly_limit_units),
    approval_threshold_units: BigInt(db.approval_threshold_units),
    pending_raise: db.pending_raise
      ? { field: db.pending_raise.field, units: BigInt(db.pending_raise.units), effective_at: new Date(db.pending_raise.effective_at) }
      : null,
  };
}

export function limitRowToDb(row: LimitRow): LimitRowDb {
  return {
    daily_limit_units: Number(row.daily_limit_units),
    weekly_limit_units: Number(row.weekly_limit_units),
    approval_threshold_units: Number(row.approval_threshold_units),
    pending_raise: row.pending_raise
      ? { field: row.pending_raise.field, units: Number(row.pending_raise.units), effective_at: row.pending_raise.effective_at.toISOString() }
      : null,
  };
}
