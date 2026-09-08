import { describe, expect, it } from "vitest";
import { quoteShopPayment } from "@/lib/shop/quote";
import { MockSqrilClient } from "@/lib/sqril/mock";
import { SqrilNetworkError } from "@/lib/sqril/client";
import type { SqrilClient } from "@/lib/sqril/client";
import type { DecodeQrResponse } from "@/lib/sqril/types";
import { MOCK_MERCHANT } from "@/lib/sqril/mock";

const CUSTOMER_ID = "mock-cust-parent";

describe("quoteShopPayment", () => {
  it("quotes a dynamic QR straight away", async () => {
    const result = await quoteShopPayment(
      { qrString: "vietqr-dynamic-demo", customerId: CUSTOMER_ID },
      new MockSqrilClient(),
    );

    expect(result).toMatchObject({
      needsAmount: false,
      merchant: MOCK_MERCHANT,
      country: "VN",
      currency: "VND",
      amountLocal: 120_000,
      amountUsdUnits: 4_720_000n,
      feeUsdUnits: 110_000n,
      totalUsdUnits: 4_830_000n,
    });
    if (!("needsAmount" in result) || result.needsAmount) throw new Error("expected a ready quote");
    expect(result.txId).toMatch(/^mock-tx-dyn-/);
    expect(new Date(result.expiresAt).toString()).not.toBe("Invalid Date");
  });

  it("asks for an amount on a static QR with none given", async () => {
    const result = await quoteShopPayment(
      { qrString: "vietqr-static-demo", customerId: CUSTOMER_ID },
      new MockSqrilClient(),
    );

    expect(result).toEqual({
      needsAmount: true,
      txId: expect.stringMatching(/^mock-tx-static-/),
      merchant: MOCK_MERCHANT,
      currency: "VND",
      country: "VN",
    });
  });

  it("quotes a static QR once an amount is supplied", async () => {
    const result = await quoteShopPayment(
      { qrString: "vietqr-static-demo", customerId: CUSTOMER_ID, amountLocal: 50_000 },
      new MockSqrilClient(),
    );

    expect(result).toMatchObject({
      needsAmount: false,
      amountLocal: 50_000,
      amountUsdUnits: 1_970_000n,
      feeUsdUnits: 100_000n,
      totalUsdUnits: 2_070_000n,
    });
  });

  it("maps an invalid QR to a friendly message", async () => {
    const result = await quoteShopPayment(
      { qrString: "vietqr-invalid-demo", customerId: CUSTOMER_ID },
      new MockSqrilClient(),
    );

    expect(result).toEqual({
      ok: false,
      code: "INVALID_QR_FORMAT",
      message: "That code isn't a payment code.",
    });
  });

  it("maps an amount outside the corridor limit to a friendly message", async () => {
    const result = await quoteShopPayment(
      { qrString: "vietqr-static-demo", customerId: CUSTOMER_ID, amountLocal: 50_000_000 },
      new MockSqrilClient(),
    );

    expect(result).toEqual({
      ok: false,
      code: "INVALID_AMOUNT",
      message: "That amount is outside what this shop can take.",
    });
  });

  it("maps a network failure to a friendly message", async () => {
    const client = {
      decodeQrUnregistered: async () => {
        throw new SqrilNetworkError(new Error("fetch failed"));
      },
    } as unknown as SqrilClient;

    const result = await quoteShopPayment({ qrString: "any", customerId: CUSTOMER_ID }, client);

    expect(result).toEqual({
      ok: false,
      code: "NETWORK_ERROR",
      message: "Couldn't reach the payment service. Try again.",
    });
  });

  it("reports unavailable when no client is configured", async () => {
    const result = await quoteShopPayment({ qrString: "any", customerId: CUSTOMER_ID }, null);

    expect(result).toEqual({
      ok: false,
      code: "UNCONFIGURED",
      message: "Couldn't reach the payment service. Try again.",
    });
  });

  describe("merchant name fallback", () => {
    function decodeClient(response: Partial<DecodeQrResponse>): SqrilClient {
      return {
        decodeQrUnregistered: async () => ({
          tx_id: "mock-tx-static-0000000000000000",
          amount: null,
          currency: "VND",
          country: "VN",
          ...response,
        }),
      } as unknown as SqrilClient;
    }

    it("prefers merchant over merchant_name and recipient", async () => {
      const result = await quoteShopPayment(
        { qrString: "any", customerId: CUSTOMER_ID },
        decodeClient({ merchant: "Merchant A", merchant_name: "Merchant B" }),
      );
      expect(result).toMatchObject({ merchant: "Merchant A" });
    });

    it("falls back to merchant_name", async () => {
      const result = await quoteShopPayment(
        { qrString: "any", customerId: CUSTOMER_ID },
        decodeClient({ merchant_name: "Merchant B" }),
      );
      expect(result).toMatchObject({ merchant: "Merchant B" });
    });

    it("falls back to recipient.name", async () => {
      const result = await quoteShopPayment(
        { qrString: "any", customerId: CUSTOMER_ID },
        decodeClient({ recipient: { name: "Kohi Nguyen Hue" } }),
      );
      expect(result).toMatchObject({ merchant: "Kohi Nguyen Hue" });
    });

    it("falls back to recipient.name_first + name_last", async () => {
      const result = await quoteShopPayment(
        { qrString: "any", customerId: CUSTOMER_ID },
        decodeClient({ recipient: { name_first: "Kohi", name_last: "Nguyen Hue" } }),
      );
      expect(result).toMatchObject({ merchant: "Kohi Nguyen Hue" });
    });

    it("falls back to 'This shop' when nothing is present", async () => {
      const result = await quoteShopPayment(
        { qrString: "any", customerId: CUSTOMER_ID },
        decodeClient({}),
      );
      expect(result).toMatchObject({ merchant: "This shop" });
    });
  });
});
