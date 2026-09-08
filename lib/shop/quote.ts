// Quote a "pay a shop" QR scan: decodeQrUnregistered → getQuotation.
//
// Money model: Sqril returns USD as doubles at up to 4 decimal places (the
// client asks for dp=4). We format to 4dp before handing the string to
// dollarsToUnits so the resulting base units reconcile exactly with what
// Sqril will actually charge; parsing the double directly risks a binary
// float rounding a cent off.

import { getSqrilClient } from "@/lib/sqril/config";
import { SqrilApiError, SqrilNetworkError } from "@/lib/sqril/client";
import type { SqrilClient } from "@/lib/sqril/client";
import type { DecodeQrResponse } from "@/lib/sqril/types";
import { dollarsToUnits } from "@/lib/money/usdc";

export interface ShopQuoteReady {
  needsAmount: false;
  txId: string;
  merchant: string;
  country: string;
  currency: string;
  amountLocal: number;
  amountUsdUnits: bigint;
  feeUsdUnits: bigint;
  totalUsdUnits: bigint;
  expiresAt: string;
}

/** Static QR with no amount encoded: the kid must key one in before we can quote. */
export interface ShopQuoteNeedsAmount {
  needsAmount: true;
  txId: string;
  merchant: string;
  currency: string;
  country: string;
}

export type ShopQuote = ShopQuoteReady | ShopQuoteNeedsAmount;

export interface ShopQuoteError {
  ok: false;
  /** Raw Sqril error code when we have one, for logging; UI shows `message`. */
  code: string;
  message: string;
}

export interface QuoteShopPaymentInput {
  qrString: string;
  /** The family's registered Sqril customer id (the parent). */
  customerId: string;
  /** Supplied when the kid keys in an amount for a static QR. */
  amountLocal?: number;
}

const GENERIC_ERROR_MESSAGE = "Couldn't reach the payment service. Try again.";

/** Sqril's `amount` is 0 or null on a static QR: both mean "no amount yet". */
function decodedAmount(decoded: DecodeQrResponse): number | undefined {
  return decoded.amount && decoded.amount > 0 ? decoded.amount : undefined;
}

function pickMerchant(decoded: DecodeQrResponse): string {
  if (decoded.merchant) return decoded.merchant;
  if (decoded.merchant_name) return decoded.merchant_name;

  const recipient = decoded.recipient;
  if (recipient && typeof recipient === "object") {
    const name = recipient["name"];
    if (typeof name === "string" && name.trim()) return name.trim();

    const first = recipient["name_first"];
    const last = recipient["name_last"];
    const full = [first, last]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join(" ")
      .trim();
    if (full) return full;
  }

  return "This shop";
}

/** Format a Sqril USD double to 4dp, then to base units, so totals reconcile exactly. */
function usdToUnits(amount: number): bigint {
  return dollarsToUnits(amount.toFixed(4));
}

function mapSqrilError(err: unknown): ShopQuoteError {
  if (err instanceof SqrilApiError) {
    const code = err.code ?? "UNKNOWN";
    switch (code) {
      case "INVALID_QR_FORMAT":
        return { ok: false, code, message: "That code isn't a payment code." };
      case "INVALID_AMOUNT":
      case "INVALID_LIMIT":
        return { ok: false, code, message: "That amount is outside what this shop can take." };
      case "COUNTRY_NOT_SUPPORTED_BY_ACCOUNT":
        return { ok: false, code, message: "We can't pay shops in that country yet." };
      default:
        return { ok: false, code, message: GENERIC_ERROR_MESSAGE };
    }
  }
  if (err instanceof SqrilNetworkError) {
    return { ok: false, code: "NETWORK_ERROR", message: GENERIC_ERROR_MESSAGE };
  }
  return { ok: false, code: "UNKNOWN", message: GENERIC_ERROR_MESSAGE };
}

export async function quoteShopPayment(
  input: QuoteShopPaymentInput,
  client: SqrilClient | null = getSqrilClient(),
): Promise<ShopQuote | ShopQuoteError> {
  if (!client) {
    return { ok: false, code: "UNCONFIGURED", message: GENERIC_ERROR_MESSAGE };
  }

  let decoded: DecodeQrResponse;
  try {
    decoded = await client.decodeQrUnregistered({ qr_string: input.qrString });
  } catch (err) {
    return mapSqrilError(err);
  }

  const merchant = pickMerchant(decoded);
  const country = decoded.country ?? "";
  const currency = decoded.currency ?? "";
  const amountLocal = decodedAmount(decoded) ?? input.amountLocal;

  if (amountLocal === undefined || amountLocal <= 0) {
    return { needsAmount: true, txId: decoded.tx_id, merchant, currency, country };
  }

  try {
    const quote = await client.getQuotation({
      tx_id: decoded.tx_id,
      customer_id: input.customerId,
      amount: amountLocal,
    });
    const amountUsdUnits = usdToUnits(quote.amount_usd);
    const feeUsdUnits = usdToUnits(quote.fee);
    return {
      needsAmount: false,
      txId: quote.tx_id,
      merchant,
      country,
      currency: quote.currency,
      amountLocal: quote.amount,
      amountUsdUnits,
      feeUsdUnits,
      totalUsdUnits: amountUsdUnits + feeUsdUnits,
      expiresAt: quote.expires_at,
    };
  } catch (err) {
    return mapSqrilError(err);
  }
}
