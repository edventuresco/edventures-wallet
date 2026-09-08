import { afterEach, describe, expect, it, vi } from "vitest";
import { executeShopPayment, pollShopPayment } from "@/lib/shop/execute";
import { MockSqrilClient } from "@/lib/sqril/mock";
import { SqrilApiError } from "@/lib/sqril/client";
import type { SqrilClient } from "@/lib/sqril/client";

const CUSTOMER_ID = "mock-cust-parent";

describe("executeShopPayment", () => {
  it("accepts a payout and reports PROCESSING", async () => {
    const client = new MockSqrilClient();
    const decoded = await client.decodeQrUnregistered({ qr_string: "dynamic-demo" });

    const result = await executeShopPayment(
      {
        txId: decoded.tx_id,
        customerId: CUSTOMER_ID,
        amountLocal: decoded.amount!,
        currency: decoded.currency!,
        idempotencyKey: "sig_abc123",
      },
      client,
    );

    expect(result).toEqual({ ok: true, status: "PROCESSING", txId: decoded.tx_id });
  });

  it("maps INSUFFICIENT_FUNDS (402) to insufficient_float", async () => {
    const client = new MockSqrilClient();
    const decoded = await client.decodeQrUnregistered({ qr_string: "float-demo" });

    const result = await executeShopPayment(
      {
        txId: decoded.tx_id,
        customerId: CUSTOMER_ID,
        amountLocal: decoded.amount!,
        currency: decoded.currency!,
        idempotencyKey: "sig_float",
      },
      client,
    );

    expect(result).toEqual({
      ok: false,
      reason: "insufficient_float",
      message: "This shop can't be paid right now. Try again in a little while.",
    });
  });

  it("maps QUOTATION_EXPIRED to expired", async () => {
    const client = {
      executePayout: async () => {
        throw new SqrilApiError(400, { error_code: "QUOTATION_EXPIRED", error_message: "expired" });
      },
    } as unknown as SqrilClient;

    const result = await executeShopPayment(
      { txId: "t", customerId: CUSTOMER_ID, amountLocal: 1000, currency: "VND", idempotencyKey: "sig" },
      client,
    );

    expect(result).toEqual({
      ok: false,
      reason: "expired",
      message: "That quote timed out. Scan the code again.",
    });
  });

  it("maps TRANSACTION_NOT_PENDING to not_pending", async () => {
    const client = {
      executePayout: async () => {
        throw new SqrilApiError(400, {
          error_code: "TRANSACTION_NOT_PENDING",
          error_message: "already processed",
          current_status: "SUCCESS",
        });
      },
    } as unknown as SqrilClient;

    const result = await executeShopPayment(
      { txId: "t", customerId: CUSTOMER_ID, amountLocal: 1000, currency: "VND", idempotencyKey: "sig" },
      client,
    );

    expect(result).toEqual({
      ok: false,
      reason: "not_pending",
      message: "This payment already went through. Check your history before trying again.",
    });
  });

  it("maps an unrecognized API error to unavailable", async () => {
    const client = {
      executePayout: async () => {
        throw new SqrilApiError(500, { error_code: "INTERNAL_SERVER_ERROR", error_message: "oops" });
      },
    } as unknown as SqrilClient;

    const result = await executeShopPayment(
      { txId: "t", customerId: CUSTOMER_ID, amountLocal: 1000, currency: "VND", idempotencyKey: "sig" },
      client,
    );

    expect(result).toEqual({
      ok: false,
      reason: "unavailable",
      message: "Couldn't reach the payment service. Try again.",
    });
  });

  it("reports unavailable when no client is configured", async () => {
    const result = await executeShopPayment(
      { txId: "t", customerId: CUSTOMER_ID, amountLocal: 1000, currency: "VND", idempotencyKey: "sig" },
      null,
    );

    expect(result).toEqual({
      ok: false,
      reason: "unavailable",
      message: "Couldn't reach the payment service. Try again.",
    });
  });
});

describe("pollShopPayment", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately once a transaction has already succeeded", async () => {
    const client = new MockSqrilClient();
    const decoded = await client.decodeQrUnregistered({ qr_string: "dynamic-demo" });

    const result = await pollShopPayment(decoded.tx_id, client, { sleep: async () => {} });

    expect(result.status).toBe("SUCCESS");
  });

  it("returns FAILED for a transaction the mock marks failed", async () => {
    const client = new MockSqrilClient();
    const decoded = await client.decodeQrUnregistered({ qr_string: "fail-demo" });

    const result = await pollShopPayment(decoded.tx_id, client, { sleep: async () => {} });

    expect(result.status).toBe("FAILED");
  });

  it("polls at intervalMs via the injected sleep until the transaction settles", async () => {
    let calls = 0;
    const getTransaction = vi.fn(async () => {
      calls += 1;
      return { transaction: { status: calls < 3 ? "PROCESSING" : ("SUCCESS" as const) } };
    });
    const client = { getTransaction } as unknown as SqrilClient;
    const sleep = vi.fn(async () => {});

    const result = await pollShopPayment("mock-tx-dyn-abc", client, {
      intervalMs: 500,
      timeoutMs: 10_000,
      sleep,
    });

    expect(result.status).toBe("SUCCESS");
    expect(getTransaction).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it("gives up after timeoutMs of elapsed time", async () => {
    vi.useFakeTimers();

    const getTransaction = vi.fn(async () => ({ transaction: { status: "PROCESSING" as const } }));
    const client = { getTransaction } as unknown as SqrilClient;

    const resultPromise = pollShopPayment("mock-tx-dyn-abc", client, {
      timeoutMs: 5_000,
      intervalMs: 1_000,
    });

    await vi.advanceTimersByTimeAsync(6_000);
    const result = await resultPromise;

    expect(result.status).toBe("TIMEOUT");
    expect(getTransaction.mock.calls.length).toBeGreaterThan(1);
  });
});
