/**
 * The Share jar: a donation jar. The kid picks a person or cause from their
 * list and asks; a guardian says yes every time; then the kid taps to share
 * from the share jar. Pure rules here: amounts, who can receive, what the
 * jar holds, and which approved request covers a share today.
 */

import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";
import { sameLocalDay } from "@/lib/rules/tz";

const DOLLARS_RE = /^\d+(?:\.\d{1,2})?$/;

export const ERR_SHARE_AMOUNT = "That amount doesn't look right. Try typing it again.";

export type ShareContactRule = { id: string; label: string; status: "active" | "requested" | "removed" };

export function validateShareAmount(dollars: string): { ok: true; units: bigint } | { ok: false; message: string } {
  const trimmed = dollars.trim();
  if (!DOLLARS_RE.test(trimmed)) return { ok: false, message: ERR_SHARE_AMOUNT };
  const units = dollarsToUnits(trimmed);
  if (units <= 0n) return { ok: false, message: ERR_SHARE_AMOUNT };
  return { ok: true, units };
}

export function checkShareContact(contact: ShareContactRule | null): { ok: true } | { ok: false; message: string } {
  if (!contact || contact.status === "removed") return { ok: false, message: "That person isn't on your list yet. Ask a parent to add them." };
  if (contact.status === "requested") return { ok: false, message: `${contact.label} isn't on your list yet. A parent still needs to say yes.` };
  return { ok: true };
}

export function checkShareBalance(units: bigint, balanceUnits: bigint): { ok: true } | { ok: false; message: string } {
  if (balanceUnits >= units) return { ok: true };
  return {
    ok: false,
    message: balanceUnits > 0n ? `Your share jar has ${unitsToDisplay(balanceUnits)} right now. Try a smaller amount.` : "Your share jar is empty right now. Your next allowance adds to it.",
  };
}

/** A `requests` row of type "share", as read from the table. */
export type ShareRequestRow = {
  id: string;
  status: string;
  payload: { contactId?: string; dollars?: string; label?: string } | null;
  decided_at: string | null;
};

export type ApprovedShare = { id: string; contactId: string; units: bigint; dollars: string; label: string; decidedAt: Date };

function unitsOf(dollars: string | undefined): bigint | null {
  try {
    return dollars === undefined ? null : dollarsToUnits(dollars);
  } catch {
    return null;
  }
}

/**
 * The newest request a guardian approved today, optionally for one person
 * and amount. Approval is per share: a yes for $2.00 to Grandma covers
 * exactly that, once, today.
 */
export function findApprovedShare(rows: ShareRequestRow[], target: { contactId?: string; units?: bigint; now: Date; timeZone: string }): ApprovedShare | null {
  const candidates = rows
    .filter((r) => r.status === "approved" && r.decided_at && r.payload?.contactId)
    .map((r) => ({ row: r, units: unitsOf(r.payload?.dollars), decidedAt: new Date(r.decided_at as string) }))
    .filter((c): c is typeof c & { units: bigint } => c.units !== null && sameLocalDay(c.decidedAt, target.now, target.timeZone))
    .filter((c) => (target.contactId === undefined || c.row.payload?.contactId === target.contactId) && (target.units === undefined || c.units === target.units))
    .sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime());
  const best = candidates[0];
  if (!best) return null;
  const payload = best.row.payload as NonNullable<ShareRequestRow["payload"]>;
  return { id: best.row.id, contactId: payload.contactId as string, units: best.units, dollars: payload.dollars as string, label: payload.label ?? "", decidedAt: best.decidedAt };
}

/** The `events` sentence once the share lands. */
export function shareSummary(units: bigint, label: string): string {
  return `Shared ${unitsToDisplay(units)} with ${label}`;
}

/** What the guardian reads in their inbox. */
export function shareRequestSentence(kidName: string, amountDisplay: string, label: string): string {
  return `${kidName} wants to share ${amountDisplay} with ${label} from their share jar`;
}
