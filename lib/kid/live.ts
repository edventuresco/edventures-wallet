/**
 * The kid's screen reacting live. Pure: one Realtime change on `requests`
 * or `events` in, the toast sentence (or nothing) out. The component only
 * wires the socket and refreshes the page.
 */

import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";

export type KidLiveTable = "requests" | "events";

/** The columns the kid side reads off a row. Realtime sends whatever the replica identity allows. */
export type KidLiveRow = {
  id?: string;
  status?: string;
  type?: string;
  kind?: string;
  summary?: string;
  payload?: Record<string, unknown> | null;
};

export type KidChange = {
  table: KidLiveTable;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: KidLiveRow | null;
  old: KidLiveRow | null;
};

export type KidLiveContext = { parentLabel: string };

/** Shape a Realtime postgres_changes payload into a change; null for anything that is not a row change. */
export function toKidChange(table: KidLiveTable, payload: { eventType: string; new?: unknown; old?: unknown }): KidChange | null {
  if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE" && payload.eventType !== "DELETE") return null;
  return { table, eventType: payload.eventType, new: asRow(payload.new), old: asRow(payload.old) };
}

function asRow(value: unknown): KidLiveRow | null {
  if (!value || typeof value !== "object" || Object.keys(value).length === 0) return null;
  return value as KidLiveRow;
}

function dollarsDisplay(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    return unitsToDisplay(dollarsToUnits(value));
  } catch {
    return null;
  }
}

/** "Tap to send $22.00 to Sam." / "Tap to share $2.00 with Grandma." from an approved request's payload. */
function nextStep(row: KidLiveRow): string | null {
  const payload = row.payload ?? {};
  const amount = dollarsDisplay(payload.dollars);
  const label = typeof payload.label === "string" && payload.label.trim() ? payload.label.trim() : null;
  if (!amount || !label) return null;
  return row.type === "share" ? `Tap to share ${amount} with ${label}.` : `Tap to send ${amount} to ${label}.`;
}

/** Whether a change is worth a fresh server render (balances, cards, history). */
export function shouldRefresh(change: KidChange): boolean {
  if (change.table === "events") return change.eventType === "INSERT";
  return change.eventType === "UPDATE" && change.old?.status !== change.new?.status;
}

/**
 * The sentence to show the kid, or null to stay quiet. A guardian's yes or
 * no on a request; an allowance or money arriving; someone new on the list.
 * The kid's own sends, saves and stops already have their own moment.
 */
export function kidToastFor(change: KidChange, ctx: KidLiveContext): string | null {
  if (change.table === "requests") {
    if (change.eventType !== "UPDATE" || !change.new) return null;
    const was = change.old?.status;
    const now = change.new.status;
    if (was === now) return null;
    if (now === "approved" && (was === "pending" || was === undefined)) {
      const step = nextStep(change.new);
      return step ? `${ctx.parentLabel} said yes! ${step}` : `${ctx.parentLabel} said yes!`;
    }
    if (now === "declined" && (was === "pending" || was === undefined)) return `Not this time. ${ctx.parentLabel} said no to that one.`;
    return null;
  }
  if (change.eventType !== "INSERT" || !change.new) return null;
  const summary = change.new.summary?.trim() || null;
  switch (change.new.kind) {
    case "allowance":
      return "Your allowance just landed!";
    case "received":
      return summary ?? "Money just arrived!";
    case "contact_added":
      return summary ?? "Someone new is on your list.";
    default:
      return null;
  }
}
