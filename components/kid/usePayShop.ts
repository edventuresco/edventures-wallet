"use client";

// State machine for the kid "pay a shop" screen. Scan → quote → (amount) →
// ready → pay (prepare, sign on this device, submit) → poll until the shop
// confirms. Every decision about money lives in the server actions; this
// hook only sequences them and turns their answers into screen states.

import { useCallback, useEffect, useRef, useState } from "react";
import { getShopPaymentStatus, prepareShopPayment, quoteShop, submitShopPayment } from "@/app/kid/pay/actions";
import { getOrCreateDeviceKey } from "@/lib/device/key";
import type { ShopQuoteView } from "@/lib/shop/flow";

export type ReadyQuote = Extract<ShopQuoteView, { ok: true; needsAmount: false }>;
export type NeedsAmountQuote = Extract<ShopQuoteView, { ok: true; needsAmount: true }>;

export type PayShopState =
  | { step: "scan" }
  | { step: "quoting"; qrString: string; merchantHint?: string }
  | { step: "needs-amount"; qrString: string; quote: NeedsAmountQuote }
  | { step: "ready"; qrString: string; quote: ReadyQuote; wasStatic: boolean }
  | { step: "paying"; qrString: string; quote: ReadyQuote; wasStatic: boolean; message: string }
  | { step: "paid"; quote: ReadyQuote; message: string; explorerUrl: string | null }
  /** A stop the kid can tap "Try again" on: nothing moved and the quote is still good. */
  | { step: "failed"; qrString: string; quote: ReadyQuote; wasStatic: boolean; message: string }
  /** A stop that needs a fresh scan (or a different amount): the quote is done with. */
  | { step: "stopped"; qrString: string; quote: ReadyQuote | NeedsAmountQuote | null; wasStatic: boolean; message: string }
  /** The shop had not confirmed within the polling window; the payment is still in flight. */
  | { step: "slow"; quote: ReadyQuote; txId: string; message: string; explorerUrl: string | null };

export type PayShopDeps = {
  quoteShop: typeof quoteShop;
  prepareShopPayment: typeof prepareShopPayment;
  submitShopPayment: typeof submitShopPayment;
  getShopPaymentStatus: typeof getShopPaymentStatus;
  getDeviceKey: typeof getOrCreateDeviceKey;
};

export type PayShopOptions = {
  /** Between status polls. Default 2 seconds. */
  pollIntervalMs?: number;
  /** Give up waiting for the shop after this long. Default 2 minutes. */
  pollTimeoutMs?: number;
  deps?: Partial<PayShopDeps>;
};

const DEFAULT_DEPS: PayShopDeps = { quoteShop, prepareShopPayment, submitShopPayment, getShopPaymentStatus, getDeviceKey: getOrCreateDeviceKey };

const SIGN_FAILED = "This device couldn't sign the payment. Nothing was paid. Try again.";
const ACTION_FAILED = "That didn't go through, and nothing was paid. Try again in a moment.";
const SLOW_MESSAGE = "The shop hasn't confirmed yet, but your payment is still on its way. Check your history in a little while.";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function usePayShop(options: PayShopOptions = {}) {
  // Read through a ref so the callbacks below keep their identity across
  // renders: QrScanner restarts the camera whenever its onResult changes.
  const config = useRef({ deps: DEFAULT_DEPS, pollIntervalMs: 2_000, pollTimeoutMs: 120_000 });
  config.current = {
    deps: { ...DEFAULT_DEPS, ...options.deps },
    pollIntervalMs: options.pollIntervalMs ?? 2_000,
    pollTimeoutMs: options.pollTimeoutMs ?? 120_000,
  };

  const [state, setState] = useState<PayShopState>({ step: "scan" });
  const stateRef = useRef(state);
  stateRef.current = state;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const set = useCallback((next: PayShopState) => {
    if (alive.current) setState(next);
  }, []);

  /** Decode + quote a scanned string, or re-quote a static code once the kid keyed in an amount. */
  const quote = useCallback(
    async (qrString: string, amountLocal?: number, merchantHint?: string) => {
      const { deps } = config.current;
      const wasStatic = amountLocal !== undefined;
      // A static code's shop details survive a refused amount, so "Try a different amount" can go back to the pad.
      const before = stateRef.current;
      const staticQuote = wasStatic && before.step === "needs-amount" ? before.quote : null;
      set({ step: "quoting", qrString, merchantHint });
      let view: ShopQuoteView;
      try {
        view = await deps.quoteShop(amountLocal === undefined ? { qrString } : { qrString, amountLocal });
      } catch {
        view = { ok: false, message: "Couldn't reach the payment service. Try again." };
      }
      if (!view.ok) return set({ step: "stopped", qrString, quote: staticQuote, wasStatic, message: view.message });
      if (view.needsAmount) return set({ step: "needs-amount", qrString, quote: view });
      set({ step: "ready", qrString, quote: view, wasStatic });
    },
    [set],
  );

  const poll = useCallback(
    async (quoteView: ReadyQuote, txId: string, explorerUrl: string | null) => {
      const { deps, pollIntervalMs, pollTimeoutMs } = config.current;
      const deadline = Date.now() + pollTimeoutMs;
      for (;;) {
        let status: Awaited<ReturnType<typeof deps.getShopPaymentStatus>>;
        try {
          status = await deps.getShopPaymentStatus(txId);
        } catch {
          status = { ok: true, status: "processing", message: `${quoteView.merchant} is checking the payment…`, explorerUrl };
        }
        if (!alive.current) return;
        if (!status.ok) return set({ step: "stopped", qrString: "", quote: quoteView, wasStatic: false, message: status.message });
        if (status.status === "success") return set({ step: "paid", quote: quoteView, message: status.message, explorerUrl: status.explorerUrl ?? explorerUrl });
        if (status.status === "failed") return set({ step: "stopped", qrString: "", quote: quoteView, wasStatic: false, message: status.message });
        set({ step: "paying", qrString: "", quote: quoteView, wasStatic: false, message: status.message });
        if (Date.now() >= deadline) return set({ step: "slow", quote: quoteView, txId, message: SLOW_MESSAGE, explorerUrl: status.explorerUrl ?? explorerUrl });
        await sleep(pollIntervalMs);
      }
    },
    [set],
  );

  /** Prepare on the server, sign on this device, submit, then wait for the shop. */
  const pay = useCallback(async () => {
    if (state.step !== "ready" && state.step !== "failed") return;
    const { deps } = config.current;
    const { qrString, quote: quoteView, wasStatic } = state;
    const paying = (message: string) => set({ step: "paying", qrString, quote: quoteView, wasStatic, message });
    const failed = (message: string) => set({ step: "failed", qrString, quote: quoteView, wasStatic, message });
    const stopped = (message: string) => set({ step: "stopped", qrString, quote: quoteView, wasStatic, message });

    paying("Getting your payment ready…");
    let prepared: Awaited<ReturnType<typeof deps.prepareShopPayment>>;
    try {
      prepared = await deps.prepareShopPayment({ txId: quoteView.txId });
    } catch {
      return failed(ACTION_FAILED);
    }
    if (!prepared.ok) return prepared.retryable ? failed(prepared.message) : stopped(prepared.message);

    paying("Signing on this device…");
    let signedTxBase64: string;
    try {
      signedTxBase64 = await (await deps.getDeviceKey()).signTransaction(prepared.txBase64);
    } catch {
      return failed(SIGN_FAILED);
    }

    paying("Sending your money…");
    let submitted: Awaited<ReturnType<typeof deps.submitShopPayment>>;
    try {
      submitted = await deps.submitShopPayment({ txId: quoteView.txId, token: prepared.token, signedTxBase64 });
    } catch {
      return failed(ACTION_FAILED);
    }
    if (!submitted.ok) return submitted.retryable ? failed(submitted.message) : stopped(submitted.message);

    paying(`Telling ${quoteView.merchant}…`);
    await poll(quoteView, submitted.txId, submitted.explorerUrl);
  }, [poll, set, state]);

  const reset = useCallback(() => set({ step: "scan" }), [set]);

  /** Back to the number pad for a static code, keeping what we know about the shop. */
  const changeAmount = useCallback(() => {
    if (state.step !== "stopped" || !state.quote) return;
    const { txId, merchant, currency, country } = state.quote;
    set({ step: "needs-amount", qrString: state.qrString, quote: { ok: true, needsAmount: true, txId, merchant, currency, country } });
  }, [set, state]);

  return { state, quote, pay, reset, changeAmount };
}
