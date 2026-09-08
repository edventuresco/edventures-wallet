// Settling a shop payment: the one place a row goes from in-flight
// (paid_onchain / processing) to success or failed and the payer's history
// (the kid's, or the parent's own) gets its shop_paid / shop_failed line. The signed webhook calls this with
// the admin client; the kid's status poll calls it with the kid's own client
// after asking Sqril directly (covers a missed webhook and mock mode). The
// update is guarded on the in-flight statuses, so whichever path arrives
// second updates nothing and writes no event.

import type { SupabaseClient } from "@supabase/supabase-js";
import { SHOP_PAYMENT_COLUMNS, afterChainFailureReason, shopEventSummary, type ShopPaymentRow } from "./flow";
import { refundShopPayment } from "./refund";

export type SettleShopPaymentInput = {
  txId: string;
  outcome: "success" | "failed";
  /** Sqril's error_message / refund_reason; kept for guardians, not shown to the kid verbatim. */
  reason?: string | null;
};

export type SettleShopPaymentResult = { settled: true; payment: ShopPaymentRow } | { settled: false; payment: ShopPaymentRow | null };

export async function settleShopPayment(db: SupabaseClient, input: SettleShopPaymentInput): Promise<SettleShopPaymentResult> {
  const now = new Date().toISOString();
  const { data: current } = await db.from("shop_payments").select(SHOP_PAYMENT_COLUMNS).eq("sqril_tx_id", input.txId).maybeSingle();
  const before = (current as ShopPaymentRow | null) ?? null;
  if (!before) return { settled: false, payment: null };

  const { data, error } = await db
    .from("shop_payments")
    .update({
      status: input.outcome,
      failure_reason: input.outcome === "failed" ? afterChainFailureReason(BigInt(before.total_usd_units)) : null,
      updated_at: now,
    })
    .eq("sqril_tx_id", input.txId)
    .in("status", ["paid_onchain", "processing"])
    .select(SHOP_PAYMENT_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error("shop.settle: failed to update shop_payments", error.message);
    return { settled: false, payment: before };
  }
  const payment = (data as ShopPaymentRow | null) ?? null;
  if (!payment) return { settled: false, payment: before };

  await recordOutcome(db, payment, input.reason ?? null);
  if (input.outcome === "failed") {
    try {
      await refundShopPayment({ paymentId: payment.id, familyId: payment.family_id, kidId: payment.kid_id, amountUnits: BigInt(payment.total_usd_units), signature: payment.signature });
    } catch (err) {
      // Expected until the keeper refund lands; the row's failure_reason already says a parent can move it back.
      console.error("shop.settle: refund still owed for", payment.id, err instanceof Error ? err.message : String(err));
    }
  }
  return { settled: true, payment };
}

/** events.user_id is required; the row remembers the paying device's user, with a lookup as a fallback. */
async function userIdFor(db: SupabaseClient, payment: ShopPaymentRow): Promise<string | null> {
  if (payment.user_id) return payment.user_id;
  if (!payment.kid_id) return null; // A parent's row always carries user_id; nothing else to look up.
  const { data } = await db.from("devices").select("user_id").eq("kid_id", payment.kid_id).eq("status", "active").not("user_id", "is", null).limit(1).maybeSingle();
  return (data as { user_id: string } | null)?.user_id ?? null;
}

async function recordOutcome(db: SupabaseClient, payment: ShopPaymentRow, providerReason: string | null): Promise<void> {
  const userId = await userIdFor(db, payment);
  if (!userId) {
    console.error("shop.settle: no user to record the event against for payment", payment.id);
    return;
  }
  const kind = payment.status === "success" ? "shop_paid" : "shop_failed";
  const { error } = await db.from("events").insert({
    user_id: userId,
    family_id: payment.family_id,
    kid_id: payment.kid_id,
    kind,
    amount_units: payment.total_usd_units,
    counterparty: payment.merchant,
    signature: payment.signature,
    reason: kind === "shop_failed" ? (providerReason ?? "sqril_failed") : null,
    summary: shopEventSummary(kind, payment),
  });
  if (error) console.error("shop.settle: failed to record event", error.message);
}
