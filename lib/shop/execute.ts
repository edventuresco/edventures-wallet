// Execute a "pay a shop" quote: executePayout (idempotency key = the kid's
// on-chain transfer signature, produced elsewhere) → pollShopPayment against
// getTransaction. The on-chain leg is not this module's job: a parent
// component sends the kid's USDC transfer first, then calls
// executeShopPayment with that signature as the idempotency key.

import { getSqrilClient } from "@/lib/sqril/config";
import { SqrilApiError } from "@/lib/sqril/client";
import type { SqrilClient } from "@/lib/sqril/client";
import type { Transaction, TxStatus } from "@/lib/sqril/types";

export interface ExecuteShopPaymentInput {
  txId: string;
  customerId: string;
  amountLocal: number;
  currency: string;
  /** The kid's on-chain transfer signature; makes a retry safe to replay. */
  idempotencyKey: string;
}

export type ExecuteShopPaymentResult =
  | { ok: true; status: "PROCESSING"; txId: string }
  | {
      ok: false;
      reason: "insufficient_float" | "expired" | "not_pending" | "unavailable";
      message: string;
    };

const UNAVAILABLE_MESSAGE = "Couldn't reach the payment service. Try again.";

function mapExecuteError(err: unknown): ExecuteShopPaymentResult {
  if (err instanceof SqrilApiError) {
    switch (err.code) {
      case "INSUFFICIENT_FUNDS":
        return {
          ok: false,
          reason: "insufficient_float",
          message: "This shop can't be paid right now. Try again in a little while.",
        };
      case "QUOTATION_EXPIRED":
        return {
          ok: false,
          reason: "expired",
          message: "That quote timed out. Scan the code again.",
        };
      case "TRANSACTION_NOT_PENDING":
        return {
          ok: false,
          reason: "not_pending",
          message: "This payment already went through. Check your history before trying again.",
        };
      default:
        return { ok: false, reason: "unavailable", message: UNAVAILABLE_MESSAGE };
    }
  }
  return { ok: false, reason: "unavailable", message: UNAVAILABLE_MESSAGE };
}

export async function executeShopPayment(
  input: ExecuteShopPaymentInput,
  client: SqrilClient | null = getSqrilClient(),
): Promise<ExecuteShopPaymentResult> {
  if (!client) {
    return { ok: false, reason: "unavailable", message: UNAVAILABLE_MESSAGE };
  }

  try {
    const accepted = await client.executePayout(
      {
        tx_id: input.txId,
        customer_id: input.customerId,
        amount_confirmed: input.amountLocal,
        currency: input.currency,
      },
      input.idempotencyKey,
    );
    return { ok: true, status: "PROCESSING", txId: accepted.tx_id };
  } catch (err) {
    return mapExecuteError(err);
  }
}

const SETTLED_STATUSES = new Set<TxStatus>(["SUCCESS", "FAILED"]);

export interface PollShopPaymentOptions {
  /** Give up after this long and report a timeout. Default 2 minutes. */
  timeoutMs?: number;
  /** Delay between polls. Default 2 seconds. */
  intervalMs?: number;
  /** Injectable for tests; defaults to a real setTimeout-backed sleep. */
  sleep?: (ms: number) => Promise<void>;
}

export type PollShopPaymentResult =
  | { status: "SUCCESS"; transaction: Transaction }
  | { status: "FAILED"; transaction: Transaction }
  | { status: "TIMEOUT" }
  | { status: "UNAVAILABLE" };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Poll getTransaction until it settles (SUCCESS/FAILED) or timeoutMs elapses. */
export async function pollShopPayment(
  txId: string,
  client: SqrilClient | null = getSqrilClient(),
  options: PollShopPaymentOptions = {},
): Promise<PollShopPaymentResult> {
  if (!client) return { status: "UNAVAILABLE" };

  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const sleep = options.sleep ?? defaultSleep;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    let transaction: Transaction;
    try {
      const response = await client.getTransaction(txId);
      transaction = response.transaction;
    } catch {
      return { status: "UNAVAILABLE" };
    }

    if (transaction.status && SETTLED_STATUSES.has(transaction.status)) {
      return { status: transaction.status as "SUCCESS" | "FAILED", transaction };
    }

    if (Date.now() >= deadline) return { status: "TIMEOUT" };

    await sleep(intervalMs);
  }
}
