import { describe, expect, it } from "vitest";
import {
  afterChainFailureReason,
  decideShopPayment,
  formatLocalAmount,
  isQuoteUsable,
  QUOTE_SAFETY_MARGIN_MS,
  shopEventSummary,
  shopPaySummary,
  shopReasonMessage,
  shopStatusMessage,
  toQuoteView,
  toStatusView,
  webhookOutcome,
  type ShopPaymentRow,
} from "@/lib/shop/flow";
import { dollarsToUnits } from "@/lib/money/usdc";

const base = {
  totalUnits: dollarsToUnits("3.20"),
  dailyLimitUnits: dollarsToUnits("50"),
  spentTodayUnits: 0n,
  balanceUnits: dollarsToUnits("10"),
  sponsoredToday: 0,
  sponsoredPerDay: 10,
};

function row(overrides: Partial<ShopPaymentRow> = {}): ShopPaymentRow {
  return {
    id: "p1",
    family_id: "f1",
    kid_id: "k1",
    user_id: "u1",
    sqril_tx_id: "tx1",
    merchant: "Pho 24",
    country: "VN",
    currency: "VND",
    amount_local: 79_000,
    amount_usd_units: 3_100_000,
    fee_usd_units: 100_000,
    total_usd_units: 3_200_000,
    signature: null,
    status: "quoted",
    failure_reason: null,
    expires_at: null,
    created_at: "2026-09-07T01:00:00.000Z",
    updated_at: "2026-09-07T01:00:00.000Z",
    ...overrides,
  };
}

describe("decideShopPayment", () => {
  it("lets a payment through when it fits the limit, the jar and the sponsor cap", () => {
    expect(decideShopPayment(base)).toEqual({ ok: true });
  });

  it("stops at the sponsor cap before anything else", () => {
    const result = decideShopPayment({ ...base, sponsoredToday: 10, balanceUnits: 0n });
    expect(result).toEqual({ ok: false, code: "sponsor_cap", message: "You've done a lot today. More tomorrow." });
  });

  it("says how much is left when the total goes over today's limit", () => {
    const result = decideShopPayment({ ...base, spentTodayUnits: dollarsToUnits("48") });
    expect(result).toEqual({
      ok: false,
      code: "over_daily_limit",
      message: "That's more than you can spend today. You have $2.00 left.",
    });
  });

  it("says tomorrow is a new day when nothing is left today", () => {
    const result = decideShopPayment({ ...base, spentTodayUnits: dollarsToUnits("50") });
    expect(result).toMatchObject({ code: "over_daily_limit", message: "You've spent all you can today. Tomorrow is a new day." });
  });

  it("counts in-flight spend: exactly the limit is still allowed, one unit over is not", () => {
    expect(decideShopPayment({ ...base, spentTodayUnits: dollarsToUnits("46.80") })).toEqual({ ok: true });
    expect(decideShopPayment({ ...base, spentTodayUnits: dollarsToUnits("46.80") + 1n })).toMatchObject({ code: "over_daily_limit" });
  });

  it("names both numbers when the Spend jar is short", () => {
    const result = decideShopPayment({ ...base, balanceUnits: dollarsToUnits("2.10") });
    expect(result).toEqual({
      ok: false,
      code: "not_enough_money",
      message: "That's $3.20, but your Spend jar has $2.10.",
    });
  });

  it("checks the daily limit before the jar so the kid hears the rule, not the balance", () => {
    const result = decideShopPayment({ ...base, spentTodayUnits: dollarsToUnits("50"), balanceUnits: 0n });
    expect(result).toMatchObject({ code: "over_daily_limit" });
  });
});

describe("isQuoteUsable", () => {
  const now = new Date("2026-09-07T10:00:00.000Z");

  it("is usable with more than the safety margin left", () => {
    expect(isQuoteUsable(new Date(now.getTime() + QUOTE_SAFETY_MARGIN_MS + 1).toISOString(), now)).toBe(true);
  });

  it("is not usable inside the margin or after expiry", () => {
    expect(isQuoteUsable(new Date(now.getTime() + QUOTE_SAFETY_MARGIN_MS - 1).toISOString(), now)).toBe(false);
    expect(isQuoteUsable(new Date(now.getTime() - 1).toISOString(), now)).toBe(false);
  });

  it("trusts Sqril when no expiry was stored or it is unreadable", () => {
    expect(isQuoteUsable(null, now)).toBe(true);
    expect(isQuoteUsable("not a date", now)).toBe(true);
  });
});

describe("copy", () => {
  it("formats local amounts without decimals for whole numbers and with two otherwise", () => {
    expect(formatLocalAmount(79_000)).toBe("79,000");
    expect(formatLocalAmount(12.5)).toBe("12.50");
  });

  it("writes the pay summary and the history lines", () => {
    expect(shopPaySummary(row())).toBe("Pay 79,000 VND at Pho 24 · $3.20");
    expect(shopEventSummary("shop_paid", row())).toBe("Paid 79,000 VND at Pho 24 · $3.20");
    expect(shopEventSummary("shop_failed", row())).toBe("Pho 24 didn't get paid · $3.20 is in the family wallet");
  });

  it("has a specific status line for every step", () => {
    expect(shopStatusMessage(row({ status: "quoted" }))).toBe("Ready to pay Pho 24.");
    expect(shopStatusMessage(row({ status: "paid_onchain" }))).toBe("$3.20 left your Spend jar. Telling Pho 24 now…");
    expect(shopStatusMessage(row({ status: "processing" }))).toBe("Pho 24 is checking the payment. This usually takes a few seconds.");
    expect(shopStatusMessage(row({ status: "success" }))).toBe("Paid. Pho 24 has your $3.20.");
    expect(shopStatusMessage(row({ status: "failed" }))).toBe("Pho 24 didn't get paid. Your $3.20 is in the family wallet, and a parent can move it back.");
    expect(shopStatusMessage(row({ status: "failed", failure_reason: afterChainFailureReason(3_200_000n) }))).toBe(
      "Pho 24 didn't get paid. Your $3.20 is in the family wallet for now, and a parent can move it back.",
    );
  });

  it("never says 'something went wrong'", () => {
    const lines = [
      ...(["quoted", "paid_onchain", "processing", "success", "failed"] as const).map((status) => shopStatusMessage(row({ status }))),
      ...(["not_on_list", "over_person_limit", "over_daily_limit", "not_enough_money", "unknown"] as const).map(shopReasonMessage),
    ];
    for (const line of lines) expect(line.toLowerCase()).not.toContain("something went wrong");
  });

  it("rewords Swig rejections for a shop payment", () => {
    expect(shopReasonMessage("over_daily_limit")).toBe("That's more than your limit for today. Try again tomorrow.");
    expect(shopReasonMessage("not_enough_money")).toBe("You don't have enough in your Spend jar for that yet.");
    expect(shopReasonMessage("unknown")).toBe("That didn't go through, and nothing was paid. Try again in a moment.");
  });
});

describe("webhookOutcome", () => {
  it("maps SUCCESS to success and FAILED or REFUNDED to failed", () => {
    expect(webhookOutcome("SUCCESS")).toBe("success");
    expect(webhookOutcome("FAILED")).toBe("failed");
    expect(webhookOutcome("REFUNDED")).toBe("failed");
  });

  it("ignores statuses that are not terminal", () => {
    expect(webhookOutcome("PROCESSING")).toBeNull();
    expect(webhookOutcome("PENDING")).toBeNull();
    expect(webhookOutcome("")).toBeNull();
  });
});

describe("views", () => {
  it("sends bigints to the client as decimal strings plus display", () => {
    const view = toQuoteView({
      needsAmount: false,
      txId: "tx1",
      merchant: "Pho 24",
      country: "VN",
      currency: "VND",
      amountLocal: 79_000,
      amountUsdUnits: 3_100_000n,
      feeUsdUnits: 100_000n,
      totalUsdUnits: 3_200_000n,
      expiresAt: "2026-09-07T10:30:00.000Z",
    });
    expect(view).toEqual({
      ok: true,
      needsAmount: false,
      txId: "tx1",
      merchant: "Pho 24",
      country: "VN",
      currency: "VND",
      amountLocal: 79_000,
      amountLocalDisplay: "79,000",
      amountUsdUnits: "3100000",
      feeUsdUnits: "100000",
      totalUsdUnits: "3200000",
      amountUsd: { units: 3_100_000, display: "$3.10" },
      feeUsd: { units: 100_000, display: "$0.10" },
      totalUsd: { units: 3_200_000, display: "$3.20" },
      expiresAt: "2026-09-07T10:30:00.000Z",
    });
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it("passes a static code through as needs-amount", () => {
    expect(toQuoteView({ needsAmount: true, txId: "tx2", merchant: "Kohi", currency: "VND", country: "VN" })).toEqual({
      ok: true,
      needsAmount: true,
      txId: "tx2",
      merchant: "Kohi",
      currency: "VND",
      country: "VN",
    });
  });

  it("builds the status view from the row", () => {
    expect(toStatusView(row({ status: "success", signature: "sig" }), "https://explorer.test/tx/sig")).toEqual({
      ok: true,
      status: "success",
      message: "Paid. Pho 24 has your $3.20.",
      explorerUrl: "https://explorer.test/tx/sig",
    });
  });
});

describe("decideShopPayment for a parent", () => {
  it("has no daily limit, only the balance and the sponsor cap", () => {
    const base = { totalUnits: dollarsToUnits("50"), dailyLimitUnits: null, spentTodayUnits: 0n, sponsoredToday: 0, sponsoredPerDay: 10, walletLabel: "family wallet" };
    expect(decideShopPayment({ ...base, balanceUnits: dollarsToUnits("60") })).toEqual({ ok: true });
    const short = decideShopPayment({ ...base, balanceUnits: dollarsToUnits("20") });
    expect(short).toMatchObject({ ok: false, code: "not_enough_money" });
    expect((short as { message: string }).message).toContain("your family wallet has $20.00");
    expect(decideShopPayment({ ...base, balanceUnits: dollarsToUnits("60"), sponsoredToday: 10 })).toMatchObject({ ok: false, code: "sponsor_cap" });
  });
});
