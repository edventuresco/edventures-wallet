// Deterministic, stateless mock of the Sqril API (SQRIL_MOCK=true) for building
// screens and rehearsing the demo without staging. Portable: Web Crypto only.
//
// Corridor: Vietnam (VietQR), the most likely demo corridor. Amounts in VND
// (0 decimals), USD fields 2 dp, rate 10 dp.
//
// Magic markers in `qr_string` drive scenarios:
//   "static"  → static QR: amount null; caller passes an amount to getQuotation.
//   "invalid" → decodeQr rejects with 400 INVALID_QR_FORMAT.
//   "fail"    → executePayout still returns 202 (failures are async);
//               getTransaction resolves to FAILED.
//   "refund"  → like fail, but the mock webhook status is REFUNDED.
//   "float"   → executePayout rejects with 402 INSUFFICIENT_FUNDS.
// Behaviour flags are encoded into the tx_id (mock-tx-<flags>-<hash16>) so
// later calls that only receive a tx_id reconstruct the scenario.

import { SqrilApiError } from "./client";
import type { SqrilClient } from "./client";
import type {
  AccountBalances,
  Customer,
  DecodeQrRequest,
  DecodeQrResponse,
  ExecutePayoutRequest,
  GetQuotationRequest,
  GetTransactionResponse,
  ListTransactionsParams,
  PayoutAccepted,
  PreviewQuotationsRequest,
  PreviewQuotationsResponse,
  Quotation,
  RegisterCustomerRequest,
  TransactionList,
  UpdateCustomerRequest,
  WebhookPayload,
} from "./types";

export const MOCK_VND_PER_USD = 25_412.5012345678;
export const MOCK_FIXED_FEE_USD = 0.1;
export const MOCK_PERCENTAGE_FEE_RATE = 0.0025;
export const MOCK_DEFAULT_AMOUNT_VND = 120_000;
export const VN_MIN_AMOUNT = 10_000;
export const VN_MAX_AMOUNT = 17_000_000;
export const QUOTE_TTL_MS = 30 * 60_000;
export const MOCK_MERCHANT = "Quan Com Tam Ba Ghien";

const round2 = (n: number) => Math.round(n * 100) / 100;

async function sha256Hex16(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

interface TxFlags {
  isStatic: boolean;
  fail: boolean;
  refund: boolean;
  float: boolean;
}

function flagsFromQr(qr: string): TxFlags {
  return {
    isStatic: qr.includes("static"),
    fail: qr.includes("fail"),
    refund: qr.includes("refund"),
    float: qr.includes("float"),
  };
}

function encodeTxId(flags: TxFlags, hash: string): string {
  const parts = (["isStatic", "fail", "refund", "float"] as const)
    .filter((k) => flags[k])
    .map((k) => (k === "isStatic" ? "static" : k));
  return `mock-tx-${parts.length ? parts.join(".") : "dyn"}-${hash}`;
}

function decodeTxId(txId: string): TxFlags | null {
  const match = /^mock-tx-([a-z.]+)-[0-9a-f]{16}$/.exec(txId);
  if (!match) return null;
  const parts = match[1].split(".");
  return {
    isStatic: parts.includes("static"),
    fail: parts.includes("fail"),
    refund: parts.includes("refund"),
    float: parts.includes("float"),
  };
}

function feesForVnd(amountVnd: number) {
  const amount_usd = round2(amountVnd / MOCK_VND_PER_USD);
  const percentage_fee = round2(amount_usd * MOCK_PERCENTAGE_FEE_RATE);
  const fixed_fee = MOCK_FIXED_FEE_USD;
  return { amount_usd, percentage_fee, fixed_fee, fee: round2(percentage_fee + fixed_fee) };
}

function assertVnCorridor(amount: number): void {
  if (amount < VN_MIN_AMOUNT || amount > VN_MAX_AMOUNT) {
    throw new SqrilApiError(400, {
      error_code: "INVALID_AMOUNT",
      error_message: `Vietnam corridor limit is ${VN_MIN_AMOUNT.toLocaleString("en-US")} to ${VN_MAX_AMOUNT.toLocaleString("en-US")} VND per transaction`,
      error: "Bad Request",
    });
  }
}

function notFound(what: string): SqrilApiError {
  return new SqrilApiError(404, { error_code: "TRANSACTION_NOT_FOUND", error_message: `${what} not found`, error: "Not Found" });
}

export class MockSqrilClient implements SqrilClient {
  async registerCustomer(body: RegisterCustomerRequest): Promise<Customer> {
    const hash = await sha256Hex16(`${body.ic_country}:${body.ic_number}`);
    const now = new Date().toISOString();
    return { ...body, customer_id: `mock-cust-${hash}`, allowed: { VN: true, PH: true, TH: true, MY: false }, created_at: now, updated_at: now };
  }

  async checkCustomer(customerId: string): Promise<Customer> {
    if (!customerId.startsWith("mock-cust-")) throw notFound("Customer");
    return {
      customer_id: customerId,
      name_first: "Test",
      name_last: "Parent",
      gender: "F",
      ic_number: "000000000000",
      ic_type: "NIC",
      ic_country: "MY",
      occupation: "OCC2",
      country_of_residence: "MY",
      phone: "+60100000000",
      email: "parent@example.com",
      nationality: "MY",
      dob: "1990-01-01",
      address: "1 Jalan Test, Kuching",
      ic_expiry_date: "2099-01-01",
      allowed: { VN: true, PH: true, TH: true, MY: false },
    };
  }

  async updateCustomer(customerId: string, body: UpdateCustomerRequest): Promise<Customer> {
    const current = await this.checkCustomer(customerId);
    return { ...current, ...body, updated_at: new Date().toISOString() };
  }

  async decodeQrUnregistered(body: DecodeQrRequest): Promise<DecodeQrResponse> {
    if (!body.qr_string) {
      throw new SqrilApiError(400, { error_code: "MISSING_REQUIRED_FIELD", error_message: "qr_string is required", error: "Bad Request" });
    }
    if (body.qr_string.includes("invalid")) {
      throw new SqrilApiError(400, { error_code: "INVALID_QR_FORMAT", error_message: "The QR payload is missing or invalid", error: "Bad Request" });
    }
    const flags = flagsFromQr(body.qr_string);
    const tx_id = encodeTxId(flags, await sha256Hex16(body.qr_string));
    const amount = flags.isStatic ? null : MOCK_DEFAULT_AMOUNT_VND;
    const fees = amount === null ? null : feesForVnd(amount);
    return {
      is_dynamic: !flags.isStatic,
      is_business: true,
      amount,
      merchant: MOCK_MERCHANT,
      merchant_name: MOCK_MERCHANT,
      country: "VN",
      currency: "VND",
      tx_id,
      partner_transaction_id: body.partner_transaction_id ?? null,
      amount_usd: fees?.amount_usd ?? null,
      fee: fees?.fee ?? null,
      percentage_fee: fees?.percentage_fee ?? null,
      fixed_fee: fees?.fixed_fee ?? null,
      missing_fields: flags.isStatic ? [{ field: "amount" }] : [],
      recipient: { name: MOCK_MERCHANT, bank_code: "970436", bank_name: "Vietcombank", account_no: "0123456789" },
    };
  }

  decodeQr(body: DecodeQrRequest & { customer_id: string }): Promise<DecodeQrResponse> {
    return this.decodeQrUnregistered(body);
  }

  async getQuotation(body: GetQuotationRequest): Promise<Quotation> {
    const flags = decodeTxId(body.tx_id);
    if (!flags) throw notFound("Transaction");
    const amount = flags.isStatic ? body.amount : (body.amount ?? MOCK_DEFAULT_AMOUNT_VND);
    if (amount === undefined) {
      throw new SqrilApiError(400, { error_code: "MISSING_REQUIRED_FIELDS", error_message: "amount is required for a static QR", error: "Bad Request", missing_fields: [{ field: "amount" }] });
    }
    assertVnCorridor(amount);
    const fees = feesForVnd(amount);
    return {
      tx_id: body.tx_id,
      amount,
      currency: "VND",
      exchange_rate: Number((1 / MOCK_VND_PER_USD).toFixed(10)),
      ...fees,
      expires_at: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    };
  }

  async previewQuotations(body: PreviewQuotationsRequest): Promise<PreviewQuotationsResponse> {
    if (!(body.amount > 0)) {
      throw new SqrilApiError(400, { error_code: "INVALID_AMOUNT", error_message: "amount must be greater than 0", error: "Bad Request" });
    }
    const usd = body.currency.toUpperCase() === "USD" ? body.amount : body.amount / MOCK_VND_PER_USD;
    const amountVnd = Math.round(usd * MOCK_VND_PER_USD);
    const fees = feesForVnd(amountVnd);
    return {
      quotations: [
        { amount: amountVnd, currency: "VND", exchange_rate: Number((1 / MOCK_VND_PER_USD).toFixed(10)), ...fees, expires_at: new Date(Date.now() + QUOTE_TTL_MS).toISOString() },
      ],
    };
  }

  async executePayout(body: ExecutePayoutRequest, idempotencyKey: string): Promise<PayoutAccepted> {
    if (!idempotencyKey) {
      throw new SqrilApiError(400, { error_code: "IDEMPOTENCY_KEY_REQUIRED", error_message: "X-Idempotency-Key header is required", error: "Bad Request" });
    }
    const flags = decodeTxId(body.tx_id);
    if (!flags) throw notFound("Transaction");
    if (flags.float) {
      throw new SqrilApiError(402, { error_code: "INSUFFICIENT_FUNDS", error_message: "Account balance is insufficient for the requested payout", error: "Payment Required" });
    }
    assertVnCorridor(body.amount_confirmed);
    const fees = feesForVnd(body.amount_confirmed);
    return {
      status: "PROCESSING",
      tx_id: body.tx_id,
      customer_id: body.customer_id,
      message: "Payout accepted",
      exchange_rate: Number((1 / MOCK_VND_PER_USD).toFixed(10)),
      ...fees,
      amount: body.amount_confirmed,
      currency: body.currency,
      partner_transaction_id: body.partner_transaction_id ?? null,
      updated_at: new Date().toISOString(),
    };
  }

  async listTransactions(params: ListTransactionsParams = {}): Promise<TransactionList> {
    return { transactions: [], total: 0, limit: params.limit ?? 50, has_more: false, next_cursor: null };
  }

  async getTransaction(transactionId: string): Promise<GetTransactionResponse> {
    const flags = decodeTxId(transactionId);
    if (!flags) throw notFound("Transaction");
    const amount = MOCK_DEFAULT_AMOUNT_VND;
    const fees = feesForVnd(amount);
    return {
      transaction: {
        id: transactionId,
        status: flags.fail || flags.refund ? "FAILED" : "SUCCESS",
        amount,
        currency: "VND",
        country_code: "VN",
        ...fees,
        total: round2(fees.amount_usd + fees.fee),
        recipient_account_name: MOCK_MERCHANT,
        updated_at: new Date().toISOString(),
      },
    };
  }

  async getAccountBalances(): Promise<AccountBalances> {
    return { balances: { USD: { available: 250, locked: 0, total: 250, currency: "USD" } } };
  }

  /** What Sqril would post for this transaction, for the mock webhook firer. */
  webhookFor(txId: string): WebhookPayload {
    const flags = decodeTxId(txId);
    if (!flags) throw notFound("Transaction");
    const fees = feesForVnd(MOCK_DEFAULT_AMOUNT_VND);
    if (flags.refund) return { tx_id: txId, status: "REFUNDED", amount: MOCK_DEFAULT_AMOUNT_VND, ...fees, refund_reason: "Payment reversal" };
    if (flags.fail) return { tx_id: txId, status: "FAILED", amount: MOCK_DEFAULT_AMOUNT_VND, ...fees, error_message: "Provider rejected the payout" };
    return { tx_id: txId, status: "SUCCESS", amount: MOCK_DEFAULT_AMOUNT_VND, ...fees };
  }
}
