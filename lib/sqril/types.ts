// Sqril SaaS API types, transcribed from https://docs.sqril.io/openapi.json and
// the endpoint pages on 2026-09-07. Portable: no Next.js or Node-only imports.
//
// Flow: registerCustomer (the parent) → decodeQrUnregistered → getQuotation →
// executePayout (X-Idempotency-Key) → webhook (base64 HMAC-SHA256).

export type IcType = "NIC" | "PP" | "WEP" | "DL";

export type Occupation =
  | "OCC1" | "OCC2" | "OCC3" | "OCC4" | "OCC5" | "OCC6"
  | "OCC7" | "OCC8" | "OCC9" | "OCC10" | "OCC11" | "OCC12";

export type TxStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

/** From https://docs.sqril.io/documentation/error-codes */
export type SqrilErrorCode =
  | "AUTHENTICATION_REQUIRED" | "INVALID_CREDENTIALS" | "INVALID_HMAC_SIGNATURE"
  | "HMAC_SIGNATURE_REQUIRED" | "TRANSACTION_NOT_OWNED" | "COUNTRY_NOT_SUPPORTED_BY_ACCOUNT"
  | "KYC_REQUIRED" | "INVALID_REQUEST" | "MISSING_REQUIRED_FIELD" | "MISSING_REQUIRED_FIELDS"
  | "INVALID_QR_FORMAT" | "INVALID_COUNTRY_CODE" | "INVALID_AMOUNT" | "INVALID_CURRENCY"
  | "INVALID_STATUS" | "INVALID_LIMIT" | "INVALID_START_AFTER" | "TRANSACTION_NOT_PENDING"
  | "QUOTATION_EXPIRED" | "METHOD_NOT_ALLOWED" | "IDEMPOTENCY_KEY_REQUIRED"
  | "CUSTOMER_NOT_ELIGIBLE" | "TRANSACTION_NOT_FOUND" | "RESOURCE_NOT_FOUND"
  | "RECIPIENT_LOOKUP_UNAVAILABLE" | "INSUFFICIENT_FUNDS" | "INTERNAL_SERVER_ERROR"
  | "PROVIDER_ERROR" | "WEBHOOK_SECRET_NOT_CONFIGURED" | "INVALID_WEBHOOK_SIGNATURE"
  | "RATE_LIMIT_EXCEEDED";

export interface SqrilErrorBody {
  error_code: SqrilErrorCode | string;
  error_message: string;
  error?: string;
  details?: unknown;
  /** Present on TRANSACTION_NOT_PENDING. */
  current_status?: TxStatus;
  /** Present on MISSING_REQUIRED_FIELDS. */
  missing_fields?: unknown[];
}

export interface RegisterCustomerRequest {
  name_first: string;
  name_last: string;
  /** "M" or "F" per the About page; Peru wants MALE/FEMALE. */
  gender: string;
  ic_number: string;
  ic_type: IcType;
  /** ISO 3166 alpha-2 of the issuing country. */
  ic_country: string;
  occupation: Occupation;
  country_of_residence: string;
  /** E.164. */
  phone: string;
  email: string;
  nationality: string;
  /** YYYY-MM-DD */
  dob: string;
  address: string;
  /** YYYY-MM-DD; 2099-01-01 for non-expiring documents. */
  ic_expiry_date: string;
  partner_app_id?: string;
}

export interface UpdateCustomerRequest {
  email?: string;
  phone?: string;
  occupation?: Occupation;
  address?: string;
  gender?: string;
}

export interface Customer extends RegisterCustomerRequest {
  customer_id: string;
  /** Corridor eligibility: ISO alpha-2 → allowed. */
  allowed?: Record<string, boolean>;
  created_at?: string;
  updated_at?: string;
}

export interface DecodeQrRequest {
  /** EMV / local QR string; for KE/TZ a numeric till or paybill number. */
  qr_string: string;
  /** Required for decodeQr, ignored by decodeQrUnregistered. */
  customer_id?: string;
  partner_transaction_id?: string;
  partner_app_id?: string;
  /** ISO 4217 when the QR does not carry a currency. */
  payment_currency?: string;
  wallet_identifier?: string;
  /** ISO alpha-2 override; required when the QR is not EMV-parseable. */
  country_code?: string;
  merchant_id?: string;
  account_reference?: string;
}

export interface DecodeQrResponse {
  is_dynamic?: boolean;
  is_business?: boolean;
  /** null or absent for static QRs: the caller supplies the amount at quotation. */
  amount?: number | null;
  merchant?: string | null;
  merchant_id?: string | null;
  merchant_name?: string | null;
  payment_type?: "till" | "paybill" | null;
  merchant_info?: Record<string, unknown> | null;
  country?: string;
  tx_id: string;
  currency?: string;
  partner_transaction_id?: string | null;
  amount_usd?: number | null;
  fee?: number | null;
  percentage_fee?: number | null;
  fixed_fee?: number | null;
  /** May be omitted on some corridors; enforced at executePayout regardless. */
  missing_fields?: unknown[];
  suggested_values?: Record<string, unknown>;
  sender?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
}

export interface GetQuotationRequest {
  tx_id: string;
  customer_id: string;
  /** Must be > 0. Required for static QRs. */
  amount?: number;
  partner_transaction_id?: string;
}

export interface Quotation {
  tx_id: string;
  amount: number;
  currency: string;
  /** 10 decimal places, source currency → USD. */
  exchange_rate: number;
  amount_usd: number;
  /** USD. fee = percentage_fee + fixed_fee within rounding. */
  fee: number;
  percentage_fee: number;
  fixed_fee: number;
  /** ISO 8601; Sqril holds a quote for about 30 minutes. */
  expires_at: string;
}

export interface PreviewQuotationsRequest {
  amount: number;
  /** ISO 4217 of `amount`, e.g. USD. */
  currency: string;
}

export interface PreviewQuotation {
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_usd: number;
  fee: number;
  percentage_fee: number;
  fixed_fee: number;
  expires_at: string;
}

export interface PreviewQuotationsResponse {
  quotations: PreviewQuotation[];
}

export interface ExecutePayoutRequest {
  tx_id: string;
  amount_confirmed: number;
  currency: string;
  customer_id: string;
  partner_transaction_id?: string;
  /** Only when decodeQr listed recipient.name in missing_fields. */
  recipient_name?: string;
}

export interface PayoutAccepted {
  status: "PROCESSING";
  tx_id: string;
  customer_id: string;
  message?: string;
  exchange_rate?: number;
  fee?: number;
  percentage_fee?: number;
  fixed_fee?: number;
  amount?: number;
  amount_usd?: number;
  currency?: string;
  sender?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
  partner_transaction_id?: string | null;
  updated_at?: string;
}

/** getTransaction schema per the docs page (all fields optional there). */
export interface Transaction {
  id?: string;
  exchange_app_id?: string;
  customer_id?: string;
  status?: TxStatus;
  amount?: number;
  amount_usd?: number;
  fee?: number;
  percentage_fee?: number;
  fixed_fee?: number;
  total?: number;
  exchange_rate?: number;
  currency?: string;
  country_code?: string;
  partner_transaction_id?: string | null;
  recipient_bank_no?: string;
  recipient_account_no?: string;
  recipient_account_name?: string;
  sender?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
  qr_data?: Record<string, unknown>;
  missing_fields?: unknown[];
  quotation_expires_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GetTransactionResponse {
  transaction: Transaction;
}

export interface ListTransactionsParams {
  status?: TxStatus;
  /** 1–100, default 50. */
  limit?: number;
  start_after?: string;
  start_date?: string;
  end_date?: string;
  detail?: "slim" | "full";
}

export interface TransactionList {
  transactions: Transaction[];
  total?: number;
  limit?: number;
  has_more?: boolean;
  next_cursor?: string | null;
}

export interface CurrencyBalance {
  available: number;
  locked: number;
  total: number;
  currency: string;
}

export interface AccountBalances {
  balances: Record<string, CurrencyBalance>;
}

/** Inbound Sqril → Edventures Wallet webhook body. */
export interface WebhookPayload {
  tx_id: string;
  status: "SUCCESS" | "FAILED" | "REFUNDED";
  amount?: number;
  fee?: number;
  percentage_fee?: number;
  fixed_fee?: number;
  error_message?: string;
  refund_reason?: string;
  sender?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
}

/** Decimal places Sqril returns for USD fields; 4 makes totals reconcile exactly. */
export type DecimalPlaces = 2 | 4 | 6 | 8;
