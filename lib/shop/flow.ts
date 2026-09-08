// Pure decisions and copy for the "pay a shop" flow, a kid's or a parent's.
// No I/O, no env: the pay core in lib/shop/pay-core.ts and the webhook route feed
// these numbers in and act on what comes back. Money is USDC base units as
// bigint here; strings cross to the client.

import { toView, unitsToDisplay, type MoneyView } from "@/lib/money/usdc";
import type { ShopQuote } from "@/lib/shop/quote";
import type { ReasonCode } from "@/lib/sponsor/reasons";

/** Lifecycle of a shop_payments row. */
export type ShopPaymentStatus = "quoted" | "paid_onchain" | "processing" | "success" | "failed";

/** A shop_payments row as PostgREST returns it (bigint columns arrive as numbers). */
export type ShopPaymentRow = {
  id: string;
  family_id: string;
  /** Null when a parent paid from the family wallet. */
  kid_id: string | null;
  user_id: string | null;
  sqril_tx_id: string;
  merchant: string;
  country: string;
  currency: string;
  amount_local: number;
  amount_usd_units: number;
  fee_usd_units: number;
  total_usd_units: number;
  signature: string | null;
  status: ShopPaymentStatus;
  failure_reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export const SHOP_PAYMENT_COLUMNS =
  "id,family_id,kid_id,user_id,sqril_tx_id,merchant,country,currency,amount_local,amount_usd_units,fee_usd_units,total_usd_units,signature,status,failure_reason,expires_at,created_at,updated_at";

/** Refuse to move money on a quote with less than this left; Sqril would refuse the payout. */
export const QUOTE_SAFETY_MARGIN_MS = 60_000;

// --- Can this payer cover this total right now?

export type ShopDecisionInput = {
  totalUnits: bigint;
  /** The kid's live daily limit (a pending raise does not count until it applies); null when the payer has none (a parent). */
  dailyLimitUnits: bigint | null;
  /** What the kid has already sent or paid today, in the family timezone. */
  spentTodayUnits: bigint;
  /** USDC in the spend jar right now. */
  balanceUnits: bigint;
  sponsoredToday: number;
  sponsoredPerDay: number;
  /** What to call the paying wallet in copy; "Spend jar" for a kid, "wallet" for a parent. */
  walletLabel?: string;
};

export type ShopDecisionCode = "sponsor_cap" | "over_daily_limit" | "not_enough_money";

export type ShopDecision = { ok: true } | { ok: false; code: ShopDecisionCode; message: string };

/**
 * The off-chain checks before the device is asked to sign. Order matters for
 * the message the kid sees: the cheapest, most permanent stop first. The
 * chain enforces the same daily total again; this is so the kid hears why in
 * words instead of a rejected transaction.
 */
export function decideShopPayment(input: ShopDecisionInput): ShopDecision {
  if (input.sponsoredToday >= input.sponsoredPerDay) {
    return { ok: false, code: "sponsor_cap", message: "You've done a lot today. More tomorrow." };
  }
  const left = input.dailyLimitUnits === null ? null : input.dailyLimitUnits - input.spentTodayUnits;
  if (left !== null && input.totalUnits > left) {
    return {
      ok: false,
      code: "over_daily_limit",
      message:
        left > 0n
          ? `That's more than you can spend today. You have ${unitsToDisplay(left)} left.`
          : "You've spent all you can today. Tomorrow is a new day.",
    };
  }
  if (input.totalUnits > input.balanceUnits) {
    return {
      ok: false,
      code: "not_enough_money",
      message: `That's ${unitsToDisplay(input.totalUnits)}, but your ${input.walletLabel ?? "Spend jar"} has ${unitsToDisplay(input.balanceUnits)}.`,
    };
  }
  return { ok: true };
}

/** True while the quote still has QUOTE_SAFETY_MARGIN_MS (or more) before Sqril lets it lapse. */
export function isQuoteUsable(expiresAt: string | null, now: Date, marginMs = QUOTE_SAFETY_MARGIN_MS): boolean {
  if (!expiresAt) return true;
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return true;
  return expires - now.getTime() >= marginMs;
}

// --- Copy

/** Swig rejection codes, said the way a shop payment needs them said. */
const SHOP_REASON_MESSAGES: Record<ReasonCode, string> = {
  not_on_list: "Your family wallet isn't on this device's list yet. Ask a parent to check your rules.",
  over_person_limit: "That's more than you can spend at shops this week. Ask a parent if you need more.",
  over_daily_limit: "That's more than your limit for today. Try again tomorrow.",
  not_enough_money: "You don't have enough in your Spend jar for that yet.",
  unknown: "That didn't go through, and nothing was paid. Try again in a moment.",
};

export function shopReasonMessage(code: ReasonCode): string {
  return SHOP_REASON_MESSAGES[code];
}

/** "79,000" for VND, "12.50" for a currency with cents. Display only; never parsed back. */
export function formatLocalAmount(amount: number): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return amount.toLocaleString("en-US", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

export type ShopEventKind = "shop_paid" | "shop_failed";

type PaymentWords = Pick<ShopPaymentRow, "amount_local" | "currency" | "merchant" | "total_usd_units">;

/** "79,000 VND at Pho 24 · $3.20": the payment in one breath. */
function paymentPhrase(payment: PaymentWords): string {
  const local = `${formatLocalAmount(Number(payment.amount_local))} ${payment.currency}`.trim();
  return `${local} at ${payment.merchant} · ${unitsToDisplay(BigInt(payment.total_usd_units))}`;
}

/** What the device is about to sign, e.g. "Pay 79,000 VND at Pho 24 · $3.20". */
export function shopPaySummary(payment: PaymentWords): string {
  return `Pay ${paymentPhrase(payment)}`;
}

/** The one-line history entry, e.g. "Paid 79,000 VND at Pho 24 · $3.20". */
export function shopEventSummary(kind: ShopEventKind, payment: PaymentWords): string {
  const total = unitsToDisplay(BigInt(payment.total_usd_units));
  return kind === "shop_paid" ? `Paid ${paymentPhrase(payment)}` : `${payment.merchant} didn't get paid · ${total} is in the family wallet`;
}

/** What the kid reads while polling. Specific to the step; no "something went wrong". */
export function shopStatusMessage(payment: Pick<ShopPaymentRow, "status" | "merchant" | "total_usd_units" | "failure_reason">, walletLabel = "Spend jar"): string {
  const total = unitsToDisplay(BigInt(payment.total_usd_units));
  switch (payment.status) {
    case "quoted":
      return `Ready to pay ${payment.merchant}.`;
    case "paid_onchain":
      return `${total} left your ${walletLabel}. Telling ${payment.merchant} now…`;
    case "processing":
      return `${payment.merchant} is checking the payment. This usually takes a few seconds.`;
    case "success":
      return `Paid. ${payment.merchant} has your ${total}.`;
    case "failed":
      return payment.failure_reason
        ? `${payment.merchant} didn't get paid. ${payment.failure_reason}`
        : `${payment.merchant} didn't get paid. Your ${total} is in the family wallet, and a parent can move it back.`;
  }
}

/** The kid-facing line stored in failure_reason when Sqril fails after the money moved. */
export function afterChainFailureReason(totalUnits: bigint): string {
  return `Your ${unitsToDisplay(totalUnits)} is in the family wallet for now, and a parent can move it back.`;
}

/** Sqril's terminal webhook statuses, folded onto the row lifecycle. REFUNDED counts as failed. */
export function webhookOutcome(status: string): "success" | "failed" | null {
  if (status === "SUCCESS") return "success";
  if (status === "FAILED" || status === "REFUNDED") return "failed";
  return null;
}

// --- What crosses to the client

export type ShopQuoteView =
  | { ok: true; needsAmount: true; txId: string; merchant: string; currency: string; country: string }
  | {
      ok: true;
      needsAmount: false;
      txId: string;
      merchant: string;
      currency: string;
      country: string;
      amountLocal: number;
      /** e.g. "79,000" */
      amountLocalDisplay: string;
      /** USDC base units as decimal strings. */
      amountUsdUnits: string;
      feeUsdUnits: string;
      totalUsdUnits: string;
      amountUsd: MoneyView;
      feeUsd: MoneyView;
      totalUsd: MoneyView;
      expiresAt: string;
    }
  | { ok: false; message: string };

export function toQuoteView(quote: ShopQuote): ShopQuoteView {
  if (quote.needsAmount) {
    return { ok: true, needsAmount: true, txId: quote.txId, merchant: quote.merchant, currency: quote.currency, country: quote.country };
  }
  return {
    ok: true,
    needsAmount: false,
    txId: quote.txId,
    merchant: quote.merchant,
    currency: quote.currency,
    country: quote.country,
    amountLocal: quote.amountLocal,
    amountLocalDisplay: formatLocalAmount(quote.amountLocal),
    amountUsdUnits: quote.amountUsdUnits.toString(),
    feeUsdUnits: quote.feeUsdUnits.toString(),
    totalUsdUnits: quote.totalUsdUnits.toString(),
    amountUsd: toView(quote.amountUsdUnits),
    feeUsd: toView(quote.feeUsdUnits),
    totalUsd: toView(quote.totalUsdUnits),
    expiresAt: quote.expiresAt,
  };
}

export type ShopPaymentStatusView = {
  ok: true;
  status: ShopPaymentStatus;
  message: string;
  explorerUrl: string | null;
};

export function toStatusView(payment: ShopPaymentRow, explorerUrl: string | null, walletLabel = "Spend jar"): ShopPaymentStatusView {
  return { ok: true, status: payment.status, message: shopStatusMessage(payment, walletLabel), explorerUrl };
}
