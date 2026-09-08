import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { webhookOutcome } from "@/lib/shop/flow";
import { settleShopPayment } from "@/lib/shop/settle";
import { redactWebhookPayload, sha256Hex, verifyWebhookRequest } from "@/lib/sqril/webhook";

export const runtime = "nodejs";

/**
 * Receiver for Sqril transaction webhooks (success, failed, refunded).
 * Authenticity is the base64 HMAC in X-SQRIL-Signature over the exact raw
 * body. Every delivery, valid or not, is recorded in sqril_webhook_events
 * when the service-role key is configured; otherwise it is logged. Payloads
 * carry the parent's KYC record, so only a redacted copy and a hash of the
 * raw body are stored. A terminal event for a known shop payment then
 * settles that payment (row status, kid history event, refund seam).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-sqril-signature");
  const verdict = await verifyWebhookRequest({ rawBody, signature, secret: process.env.SQRIL_WEBHOOK_SECRET });

  const payload = verdict.ok ? redactWebhookPayload(verdict.payload as Record<string, unknown>) : null;
  const record = {
    tx_id: typeof payload?.tx_id === "string" ? payload.tx_id : null,
    status: typeof payload?.status === "string" ? payload.status : null,
    signature_present: verdict.signaturePresent,
    signature_valid: verdict.ok,
    user_agent: request.headers.get("user-agent"),
    raw_sha256: await sha256Hex(rawBody),
    payload,
    note: verdict.ok ? (verdict.kind === "other" ? "acknowledged, not a terminal transaction event" : null) : verdict.reason,
  };

  const admin = getSupabaseAdmin();
  let recordedId: string | null = null;
  if (admin) {
    const { data, error } = await admin.from("sqril_webhook_events").insert(record).select("id").maybeSingle();
    if (error) console.error("sqril.webhook: failed to record delivery", error.message);
    recordedId = (data as { id: string } | null)?.id ?? null;
  } else {
    console.log("sqril.webhook (no SUPABASE_SERVICE_ROLE_KEY, not persisted)", JSON.stringify(record));
  }

  if (!verdict.ok) {
    return Response.json({ received: false, error: verdict.reason }, { status: verdict.httpStatus });
  }

  // A terminal event for a shop payment we know settles it. Unknown tx_ids
  // (spike runs, other partners' tests) are acknowledged and left recorded;
  // the recorded event is the source of truth either way.
  if (verdict.kind === "transaction" && admin) {
    const outcome = webhookOutcome(verdict.payload.status);
    if (outcome) {
      const reason = verdict.payload.error_message ?? verdict.payload.refund_reason ?? null;
      const result = await settleShopPayment(admin, { txId: verdict.payload.tx_id, outcome, reason });
      if (result.settled && recordedId) {
        await admin.from("sqril_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", recordedId);
      }
    }
  }
  return Response.json({ received: true });
}
