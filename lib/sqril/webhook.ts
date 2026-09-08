// Verification and parsing of an inbound Sqril webhook. Pure: no I/O, so the
// route handler stays thin and this is unit-testable.
//
// Sqril sends more event types than the docs describe (transaction.pending,
// transaction.processing, account.*). Observed on 2026-09-07: answering 400
// to those made Sqril retry them. A correctly signed delivery we do not model
// is therefore acknowledged and recorded, never rejected.

import { verifyWebhookSignature } from "./hmac";
import type { WebhookPayload } from "./types";

export type WebhookVerdict =
  | { ok: true; kind: "transaction"; payload: WebhookPayload; signaturePresent: true }
  | { ok: true; kind: "other"; payload: Record<string, unknown>; signaturePresent: true }
  | {
      ok: false;
      reason: "no_secret" | "missing_signature" | "bad_signature" | "bad_json";
      httpStatus: 503 | 401 | 400;
      signaturePresent: boolean;
    };

const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED", "REFUNDED"]);

export async function verifyWebhookRequest(input: {
  rawBody: string;
  signature: string | null;
  secret: string | undefined;
}): Promise<WebhookVerdict> {
  const signaturePresent = Boolean(input.signature);
  // Fail closed: an unsigned delivery must never move money state.
  if (!input.secret) return { ok: false, reason: "no_secret", httpStatus: 503, signaturePresent };
  if (!input.signature) return { ok: false, reason: "missing_signature", httpStatus: 401, signaturePresent };
  if (!(await verifyWebhookSignature(input.secret, input.rawBody, input.signature))) {
    return { ok: false, reason: "bad_signature", httpStatus: 401, signaturePresent };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    return { ok: false, reason: "bad_json", httpStatus: 400, signaturePresent };
  }
  const body = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  if (typeof body.tx_id === "string" && TERMINAL_STATUSES.has(String(body.status))) {
    return { ok: true, kind: "transaction", payload: body as unknown as WebhookPayload, signaturePresent: true };
  }
  return { ok: true, kind: "other", payload: body, signaturePresent: true };
}

/**
 * What we are allowed to keep. Sqril's payloads carry the sender's KYC
 * record and the recipient's account details; neither belongs in our
 * database. Keeps ids, statuses, amounts, fees, reasons and the recipient's
 * display name only.
 */
export function redactWebhookPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "sender") continue;
    if (key === "recipient" && value && typeof value === "object") {
      const r = value as Record<string, unknown>;
      const name = [r.name_first, r.name_last].filter((x) => typeof x === "string" && x).join(" ") || (typeof r.name === "string" ? r.name : undefined);
      out.recipient = { ...(name ? { name } : {}), ...(typeof r.country === "string" ? { country: r.country } : {}) };
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** SHA-256 hex of the raw body, for auditing without storing the body. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
