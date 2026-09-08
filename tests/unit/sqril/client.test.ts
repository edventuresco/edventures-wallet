import { describe, expect, it, vi } from "vitest";
import { HttpSqrilClient, SqrilApiError, SqrilNetworkError } from "@/lib/sqril/client";

type Call = { url: URL; init: RequestInit };

function fakeFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const impl = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: new URL(String(url)), init: init ?? {} });
    const next = responses.shift() ?? { status: 200, body: {} };
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function client(responses: Array<{ status: number; body?: unknown }>, extra: Partial<ConstructorParameters<typeof HttpSqrilClient>[0]> = {}) {
  const f = fakeFetch(responses);
  const c = new HttpSqrilClient({
    baseUrl: "https://stg-api.sqril.io/",
    clientId: "id",
    clientSecret: "secret",
    fetchImpl: f.impl,
    sleep: async () => {},
    ...extra,
  });
  return { c, calls: f.calls };
}

describe("HttpSqrilClient", () => {
  it("sends Basic auth from client_id:client_secret and adds dp on money endpoints", async () => {
    const { c, calls } = client([{ status: 200, body: { quotations: [] } }]);
    await c.previewQuotations({ amount: 10, currency: "USD" });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${btoa("id:secret")}`);
    expect(calls[0].url.pathname).toBe("/previewQuotations");
    expect(calls[0].url.searchParams.get("dp")).toBe("4");
  });

  it("forwards X-Idempotency-Key on executePayout", async () => {
    const { c, calls } = client([{ status: 202, body: { status: "PROCESSING", tx_id: "t", customer_id: "c" } }]);
    const accepted = await c.executePayout(
      { tx_id: "t", customer_id: "c", amount_confirmed: 100, currency: "VND" },
      "sig_abc",
    );
    expect(accepted.status).toBe("PROCESSING");
    expect((calls[0].init.headers as Record<string, string>)["X-Idempotency-Key"]).toBe("sig_abc");
  });

  it("uses decodeQrUnregistered and skips undefined query params", async () => {
    const { c, calls } = client([{ status: 200, body: { tx_id: "t" } }, { status: 200, body: { transactions: [] } }]);
    await c.decodeQrUnregistered({ qr_string: "000201" });
    expect(calls[0].url.pathname).toBe("/decodeQrUnregistered");
    await c.listTransactions({ status: "PROCESSING", limit: undefined });
    expect(calls[1].url.searchParams.get("status")).toBe("PROCESSING");
    expect(calls[1].url.searchParams.has("limit")).toBe(false);
  });

  it("throws SqrilApiError with the verbatim body and code on 402", async () => {
    const body = { error_code: "INSUFFICIENT_FUNDS", error_message: "Account balance is insufficient" };
    const { c } = client([{ status: 402, body }]);
    const err = await c.getAccountBalances().catch((e) => e);
    expect(err).toBeInstanceOf(SqrilApiError);
    expect(err.status).toBe(402);
    expect(err.code).toBe("INSUFFICIENT_FUNDS");
    expect(err.body).toEqual(body);
  });

  it("retries 429 with backoff, then succeeds", async () => {
    const { c, calls } = client([
      { status: 429, body: { error_code: "RATE_LIMIT_EXCEEDED", error_message: "slow down" } },
      { status: 200, body: { balances: {} } },
    ]);
    await expect(c.getAccountBalances()).resolves.toEqual({ balances: {} });
    expect(calls).toHaveLength(2);
  });

  it("does not retry a 400 and gives up after maxRetries on 429", async () => {
    const bad = client([{ status: 400, body: { error_code: "INVALID_AMOUNT", error_message: "x" } }]);
    await expect(bad.c.getAccountBalances()).rejects.toMatchObject({ status: 400 });
    expect(bad.calls).toHaveLength(1);

    const limited = client(
      Array.from({ length: 4 }, () => ({ status: 429, body: { error_code: "RATE_LIMIT_EXCEEDED", error_message: "x" } })),
      { maxRetries: 3 },
    );
    await expect(limited.c.getAccountBalances()).rejects.toMatchObject({ status: 429 });
    expect(limited.calls).toHaveLength(4);
  });

  it("wraps fetch failures in SqrilNetworkError after retrying", async () => {
    const impl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const c = new HttpSqrilClient({ baseUrl: "https://x", clientId: "a", clientSecret: "b", fetchImpl: impl, sleep: async () => {}, maxRetries: 1 });
    await expect(c.getAccountBalances()).rejects.toBeInstanceOf(SqrilNetworkError);
    expect(impl).toHaveBeenCalledTimes(2);
  });

  it("tolerates non-JSON error bodies", async () => {
    const impl = vi.fn(async () => new Response("<html>bad gateway</html>", { status: 500 })) as unknown as typeof fetch;
    const c = new HttpSqrilClient({ baseUrl: "https://x", clientId: "a", clientSecret: "b", fetchImpl: impl, sleep: async () => {}, maxRetries: 0 });
    const err = await c.getAccountBalances().catch((e) => e);
    expect(err).toBeInstanceOf(SqrilApiError);
    expect(err.body).toBeNull();
  });
});
