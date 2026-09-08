// Sqril API client. Portable: fetch, btoa, AbortSignal.timeout only.
// Base URL and credentials come from config.ts; this file never reads env.

import type {
  AccountBalances,
  Customer,
  DecimalPlaces,
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
  SqrilErrorBody,
  TransactionList,
  UpdateCustomerRequest,
} from "./types";

/** Non-2xx response from Sqril; body is null when it was not JSON. */
export class SqrilApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: SqrilErrorBody | null,
  ) {
    super(body?.error_message ?? `Sqril request failed with status ${status}`);
    this.name = "SqrilApiError";
  }
  get code(): string | null {
    return this.body?.error_code ?? null;
  }
}

/** Timeout, DNS failure, connection refused: Sqril never answered. */
export class SqrilNetworkError extends Error {
  constructor(cause: unknown) {
    super(`Sqril request failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "SqrilNetworkError";
  }
}

export interface SqrilClient {
  registerCustomer(body: RegisterCustomerRequest): Promise<Customer>;
  checkCustomer(customerId: string): Promise<Customer>;
  updateCustomer(customerId: string, body: UpdateCustomerRequest): Promise<Customer>;
  /** Decode with no registered customer; the customer attaches at executePayout. */
  decodeQrUnregistered(body: DecodeQrRequest): Promise<DecodeQrResponse>;
  /** Decode bound to a registered customer (verified recipient names on LATAM). */
  decodeQr(body: DecodeQrRequest & { customer_id: string }): Promise<DecodeQrResponse>;
  getQuotation(body: GetQuotationRequest): Promise<Quotation>;
  /** Stateless rates for every corridor enabled on the account. */
  previewQuotations(body: PreviewQuotationsRequest): Promise<PreviewQuotationsResponse>;
  executePayout(body: ExecutePayoutRequest, idempotencyKey: string): Promise<PayoutAccepted>;
  listTransactions(params?: ListTransactionsParams): Promise<TransactionList>;
  getTransaction(transactionId: string): Promise<GetTransactionResponse>;
  getAccountBalances(): Promise<AccountBalances>;
}

export interface SqrilClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Decimal places for USD fields in responses. 4 reconciles exactly. */
  dp?: DecimalPlaces;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Retries on 429 and network errors (exponential backoff with jitter). */
  maxRetries?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export class HttpSqrilClient implements SqrilClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly dp: DecimalPlaces;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config: SqrilClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.authHeader = `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`;
    this.dp = config.dp ?? 4;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.sleep = config.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private async request<T>(
    method: string,
    path: string,
    opts: {
      query?: Record<string, string | number | undefined>;
      body?: unknown;
      headers?: Record<string, string>;
      /** Money endpoints add dp so USD fields reconcile. */
      withDp?: boolean;
    } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    if (opts.withDp) url.searchParams.set("dp", String(this.dp));

    const headers: Record<string, string> = { Authorization: this.authHeader, ...opts.headers };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        lastError = new SqrilNetworkError(err);
        if (attempt === this.maxRetries) throw lastError;
        await this.sleep(this.backoffMs(attempt));
        continue;
      }

      if (response.ok) {
        return (await response.json()) as T;
      }

      let errorBody: SqrilErrorBody | null = null;
      try {
        errorBody = (await response.json()) as SqrilErrorBody;
      } catch {
        // Non-JSON error body: surface the status alone.
      }
      lastError = new SqrilApiError(response.status, errorBody);
      if (!RETRYABLE_STATUS.has(response.status) || attempt === this.maxRetries) throw lastError;
      await this.sleep(this.backoffMs(attempt));
    }
    throw lastError;
  }

  /** 1s, 2s, 4s ... capped at 30s, plus up to 250ms jitter (Sqril's own advice). */
  private backoffMs(attempt: number): number {
    return Math.min(1000 * 2 ** attempt, 30_000) + Math.floor(Math.random() * 250);
  }

  registerCustomer(body: RegisterCustomerRequest): Promise<Customer> {
    return this.request("POST", "/registerCustomer", { body });
  }

  checkCustomer(customerId: string): Promise<Customer> {
    return this.request("GET", "/checkCustomer", { query: { customer_id: customerId } });
  }

  updateCustomer(customerId: string, body: UpdateCustomerRequest): Promise<Customer> {
    return this.request("PUT", "/updateCustomer", { query: { customer_id: customerId }, body });
  }

  decodeQrUnregistered(body: DecodeQrRequest): Promise<DecodeQrResponse> {
    return this.request("POST", "/decodeQrUnregistered", { body, withDp: true });
  }

  decodeQr(body: DecodeQrRequest & { customer_id: string }): Promise<DecodeQrResponse> {
    return this.request("POST", "/decodeQr", { body, withDp: true });
  }

  getQuotation(body: GetQuotationRequest): Promise<Quotation> {
    return this.request("POST", "/getQuotation", { body, withDp: true });
  }

  previewQuotations(body: PreviewQuotationsRequest): Promise<PreviewQuotationsResponse> {
    return this.request("POST", "/previewQuotations", { body, withDp: true });
  }

  executePayout(body: ExecutePayoutRequest, idempotencyKey: string): Promise<PayoutAccepted> {
    return this.request("POST", "/executePayout", {
      body,
      headers: { "X-Idempotency-Key": idempotencyKey },
      withDp: true,
    });
  }

  listTransactions(params: ListTransactionsParams = {}): Promise<TransactionList> {
    return this.request("GET", "/listTransactions", { query: { ...params } });
  }

  getTransaction(transactionId: string): Promise<GetTransactionResponse> {
    return this.request("GET", "/getTransaction", { query: { transaction_id: transactionId }, withDp: true });
  }

  getAccountBalances(): Promise<AccountBalances> {
    return this.request("GET", "/getAccountBalances");
  }
}
