/**
 * The guardian's live "Requests" badge. Pure: one Realtime change on the
 * requests table in, the new pending count and the toast sentence out. The
 * component only wires the socket.
 */

import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";

/** The columns the badge reads off a requests row. Realtime sends whatever the replica identity allows. */
export type RequestRow = {
  id?: string;
  kid_id?: string;
  type?: string;
  status?: string;
  payload?: Record<string, unknown> | null;
};

export type RequestChange = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: RequestRow | null;
  old: RequestRow | null;
};

const PENDING = "pending";

const isPending = (row: RequestRow | null | undefined): boolean => row?.status === PENDING;

/** Shape a Realtime postgres_changes payload into a change; null for anything that is not a row change. */
export function toRequestChange(payload: { eventType: string; new?: unknown; old?: unknown }): RequestChange | null {
  if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE" && payload.eventType !== "DELETE") return null;
  return { eventType: payload.eventType, new: asRow(payload.new), old: asRow(payload.old) };
}

function asRow(value: unknown): RequestRow | null {
  if (!value || typeof value !== "object" || Object.keys(value).length === 0) return null;
  return value as RequestRow;
}

/**
 * Fold one change into the pending count. A new pending request adds one; a
 * decision takes one away. With `replica identity full` the old row says what
 * the status was, so approved → used does not count as a decision; without
 * it, any update off pending is read as one. Never below zero.
 */
export function applyRequestChange(count: number, change: RequestChange): number {
  let delta = 0;
  if (change.eventType === "INSERT") {
    delta = isPending(change.new) ? 1 : 0;
  } else if (change.eventType === "UPDATE") {
    const nowPending = isPending(change.new);
    const wasPending = change.old?.status === undefined ? true : isPending(change.old);
    delta = wasPending === nowPending ? 0 : nowPending ? 1 : -1;
  } else {
    delta = isPending(change.old) ? -1 : 0;
  }
  return Math.max(0, count + delta);
}

/** A brand-new request the guardian has not seen yet. */
export function isNewPending(change: RequestChange): boolean {
  return change.eventType === "INSERT" && isPending(change.new);
}

/** "Mia wants to send $22.00 to Sister", from the row's payload and the kid's name. */
export function requestToast(row: RequestRow, kidNames: Record<string, string>): string {
  const kid = (row.kid_id && kidNames[row.kid_id]) || "Your kid";
  const payload = row.payload ?? {};
  const label = typeof payload.label === "string" && payload.label.trim() ? payload.label.trim() : null;
  const amount = dollarsDisplay(payload.dollars) ?? "money";
  switch (row.type) {
    case "approve_send":
      return `${kid} wants to send ${amount}${label ? ` to ${label}` : ""}`;
    case "share":
      return `${kid} wants to share ${amount}${label ? ` with ${label}` : ""}`;
    case "add_contact":
      return `${kid} wants to add ${label ?? "someone"} to the list`;
    default:
      return `${kid} sent you a request`;
  }
}

/** "$22.00" from the payload's dollars string or number; null when it is not a dollar amount. */
function dollarsDisplay(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    return unitsToDisplay(dollarsToUnits(value));
  } catch {
    return null;
  }
}
