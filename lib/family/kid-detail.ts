/**
 * The guardian's kid-detail page view model. Pure: rows in, ready-to-render
 * strings out. Money stays in USDC base units until it becomes a display
 * string; the page never does arithmetic on dollars.
 */

import { FIELD_LABELS } from "@/components/family/contract";
import { unitsToDisplay } from "@/lib/money/usdc";
import { ageFromBirth } from "@/lib/rules/allowance";
import { avatarEmoji, dateTimeLabel } from "@/lib/rules/family";
import { appliesAtLabel, defaultLimits, limitRowFromDb, resolvePending, type LimitRowDb } from "@/lib/rules/limits";
import { clockLabel } from "@/lib/rules/tz";
import { explorerUrl } from "@/lib/solana/explorer";
import { dayLabel } from "./kid-home";

export const JARS = ["spend", "save", "share"] as const;
export type JarKind = (typeof JARS)[number];

const JAR_LABELS: Record<JarKind, string> = { spend: "Spend", save: "Save", share: "Share" };
const PROOF_LIMIT = 10;

/** One device row as the family home already reads it. */
export type DeviceRow = { status: string; joined: boolean };

export type DeviceChipLabel = "Paired" | "Waiting for you" | "No device";
export type DeviceChip = { label: DeviceChipLabel; paired: boolean };

/**
 * Same reading as the family home's kid card, over every row rather than the
 * first: an active device wins; then a pending one the kid has claimed; then
 * a code that is still valid; otherwise nothing.
 */
export function deviceChip(devices: DeviceRow[], _now: Date): DeviceChip {
  if (devices.some((d) => d.status === "active")) return { label: "Paired", paired: true };
  const pending = devices.filter((d) => d.status === "pending");
  if (pending.some((d) => d.joined)) return { label: "Waiting for you", paired: false };
  return { label: "No device", paired: false };
}

/** "Today, 14:32" / "Yesterday, 09:10" / "Tuesday, 18:05" / "28 Aug, 12:00", in the family timezone. */
export function whenLabel(instant: Date, now: Date, timeZone: string): string {
  return `${dayLabel(instant, now, timeZone)}, ${clockLabel(instant, timeZone)}`;
}

export type KidDetailInput = {
  now: Date;
  timeZone: string;
  kid: { id: string; name: string; avatar_id: string; birth_month: number | null; birth_year: number | null };
  wallets: Array<{ kind: string; wallet_address: string }>;
  /** On-chain balance per jar in base units; a jar with no wallet row reads 0. */
  balances: Record<JarKind, bigint>;
  devices: DeviceRow[];
  allowance: { amount_units: number; next_run_at: string } | null;
  contacts: Array<{ id: string; label: string; avatar_id: string; weekly_limit_units: number; status: string; onchain_synced: boolean }>;
  limits: (LimitRowDb & { onchain_synced: boolean }) | null;
  /** This kid's events, any order; the view keeps the newest ten. */
  events: Array<{ id: string; summary: string; signature: string | null; created_at: string }>;
};

export type KidDetailView = {
  kid: { id: string; name: string; avatarId: string; age: number | null };
  device: DeviceChip;
  jars: Array<{ kind: JarKind; label: string; balance: string; explorerUrl: string | null }>;
  /** "$10.00 a week, next Monday 14 Sep, 09:00"; null until an allowance is set. */
  allowance: { line: string } | null;
  contacts: Array<{ id: string; label: string; emoji: string; weeklyCap: string; onchainSynced: boolean }>;
  limits: { daily: string; weekly: string; approval: string; onchainSynced: boolean; pendingLine: string | null };
  proof: Array<{ id: string; summary: string; whenLabel: string; atISO: string; atLabel: string; explorerUrl: string | null }>;
};

export function buildKidDetailView(input: KidDetailInput): KidDetailView {
  const { now, timeZone } = input;

  const walletFor = (kind: JarKind) => input.wallets.find((w) => w.kind === kind)?.wallet_address ?? null;
  const jars = JARS.map((kind) => {
    const address = walletFor(kind);
    return { kind, label: JAR_LABELS[kind], balance: unitsToDisplay(input.balances[kind]), explorerUrl: address ? explorerUrl(address, "address") : null };
  });

  // A raise whose four hours have passed is the live value, even before the Rules screen writes it back.
  const live = input.limits ? resolvePending(limitRowFromDb(input.limits), now).row : defaultLimits("kid");
  const raise = live.pending_raise;

  const proof = [...input.events]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, PROOF_LIMIT)
    .map((e) => {
      const at = new Date(e.created_at);
      return {
        id: e.id,
        summary: e.summary,
        whenLabel: whenLabel(at, now, timeZone),
        atISO: at.toISOString(),
        atLabel: dateTimeLabel(at, timeZone),
        explorerUrl: e.signature ? explorerUrl(e.signature, "tx") : null,
      };
    });

  return {
    kid: { id: input.kid.id, name: input.kid.name, avatarId: input.kid.avatar_id, age: ageFromBirth(input.kid.birth_month, input.kid.birth_year, now) },
    device: deviceChip(input.devices, now),
    jars,
    allowance: input.allowance
      ? { line: `${unitsToDisplay(BigInt(input.allowance.amount_units))} a week, next ${dateTimeLabel(new Date(input.allowance.next_run_at), timeZone)}` }
      : null,
    contacts: input.contacts
      .filter((c) => c.status === "active")
      .map((c) => ({ id: c.id, label: c.label, emoji: avatarEmoji(c.avatar_id), weeklyCap: unitsToDisplay(BigInt(c.weekly_limit_units)), onchainSynced: c.onchain_synced })),
    limits: {
      daily: unitsToDisplay(live.daily_limit_units),
      weekly: unitsToDisplay(live.weekly_limit_units),
      approval: unitsToDisplay(live.approval_threshold_units),
      onchainSynced: input.limits?.onchain_synced ?? false,
      pendingLine: raise ? `${FIELD_LABELS[raise.field]} goes up to ${unitsToDisplay(raise.units)}. ${appliesAtLabel(raise.effective_at, now, timeZone)}.` : null,
    },
    proof,
  };
}
