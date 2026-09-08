import { describe, expect, it } from "vitest";
import { MOCK_DEFAULT_AMOUNT_VND, MockSqrilClient, VN_MAX_AMOUNT } from "@/lib/sqril/mock";

const c = new MockSqrilClient();

describe("MockSqrilClient", () => {
  it("decodes a dynamic VietQR deterministically", async () => {
    const a = await c.decodeQrUnregistered({ qr_string: "00020101021238..." });
    const b = await c.decodeQrUnregistered({ qr_string: "00020101021238..." });
    expect(a.tx_id).toBe(b.tx_id);
    expect(a.amount).toBe(MOCK_DEFAULT_AMOUNT_VND);
    expect(a.currency).toBe("VND");
    expect(a.missing_fields).toEqual([]);
  });

  it("static QR needs an amount at quotation, then quotes it", async () => {
    const d = await c.decodeQrUnregistered({ qr_string: "static-qr" });
    expect(d.amount).toBeNull();
    await expect(c.getQuotation({ tx_id: d.tx_id, customer_id: "mock-cust-x" })).rejects.toMatchObject({ status: 400 });
    const q = await c.getQuotation({ tx_id: d.tx_id, customer_id: "mock-cust-x", amount: 50_000 });
    expect(q.amount).toBe(50_000);
    expect(q.fee).toBeCloseTo(q.percentage_fee + q.fixed_fee, 2);
    expect(new Date(q.expires_at).getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);
  });

  it("enforces the Vietnam corridor limits", async () => {
    const d = await c.decodeQrUnregistered({ qr_string: "static" });
    await expect(c.getQuotation({ tx_id: d.tx_id, customer_id: "x", amount: VN_MAX_AMOUNT + 1 })).rejects.toMatchObject({ status: 400 });
  });

  it("rejects invalid QRs and unknown transactions", async () => {
    await expect(c.decodeQrUnregistered({ qr_string: "invalid" })).rejects.toMatchObject({ status: 400 });
    await expect(c.getQuotation({ tx_id: "nope", customer_id: "x" })).rejects.toMatchObject({ status: 404 });
  });

  it("executes a payout as 202 PROCESSING and resolves through getTransaction", async () => {
    const d = await c.decodeQrUnregistered({ qr_string: "dynamic" });
    const p = await c.executePayout({ tx_id: d.tx_id, customer_id: "mock-cust-x", amount_confirmed: MOCK_DEFAULT_AMOUNT_VND, currency: "VND" }, "sig1");
    expect(p.status).toBe("PROCESSING");
    expect((await c.getTransaction(d.tx_id)).transaction.status).toBe("SUCCESS");
    expect(c.webhookFor(d.tx_id).status).toBe("SUCCESS");
  });

  it("fail, refund and float markers behave as documented", async () => {
    const fail = await c.decodeQrUnregistered({ qr_string: "fail" });
    expect((await c.getTransaction(fail.tx_id)).transaction.status).toBe("FAILED");
    expect(c.webhookFor(fail.tx_id).status).toBe("FAILED");
    const refund = await c.decodeQrUnregistered({ qr_string: "refund" });
    expect(c.webhookFor(refund.tx_id).status).toBe("REFUNDED");
    const float = await c.decodeQrUnregistered({ qr_string: "float" });
    await expect(c.executePayout({ tx_id: float.tx_id, customer_id: "x", amount_confirmed: 100_000, currency: "VND" }, "k")).rejects.toMatchObject({ status: 402 });
  });

  it("requires an idempotency key", async () => {
    const d = await c.decodeQrUnregistered({ qr_string: "dynamic" });
    await expect(c.executePayout({ tx_id: d.tx_id, customer_id: "x", amount_confirmed: 100_000, currency: "VND" }, "")).rejects.toMatchObject({ status: 400 });
  });
});
