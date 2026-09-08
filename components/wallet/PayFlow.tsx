"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { getShopPaymentStatus, prepareShopPayment, quoteShop, submitShopPayment } from "@/app/pay/actions";
import { QrScanner } from "@/components/kid/QrScanner";
import { ShopPayCard } from "@/components/kid/ShopPayCard";
import { usePayShop, type PayShopOptions } from "@/components/kid/usePayShop";
import { parseVietQrSummary } from "@/lib/shop/vietqr";

const PRIMARY = "flex h-14 w-full items-center justify-center rounded-2xl bg-terracotta text-lg font-semibold text-white hover:bg-terracotta-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-terracotta/40";
const QUIET = "flex h-12 w-full items-center justify-center rounded-2xl text-base font-semibold text-forest hover:bg-sand-dark/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-terracotta/40";

function HomeLink() {
  return (
    <Link href="/" className={QUIET}>
      Back home
    </Link>
  );
}

/** A stop the parent cannot tap through: what happened, and the next step. */
function StopCard({ message, onScanAgain, onChangeAmount }: { message: string; onScanAgain: () => void; onChangeAmount?: () => void }) {
  return (
    <section className="space-y-6" aria-live="polite">
      <div className="space-y-2 rounded-[22px] border border-sand-dark bg-white p-5">
        <h2 className="text-xl text-forest">Not this time</h2>
        <p className="text-ink/80" role="alert">
          {message}
        </p>
      </div>
      <div className="space-y-2">
        {onChangeAmount && (
          <button type="button" onClick={onChangeAmount} className={PRIMARY}>
            Try a different amount
          </button>
        )}
        <button type="button" onClick={onScanAgain} className={onChangeAmount ? QUIET : PRIMARY}>
          Scan again
        </button>
        <HomeLink />
      </div>
    </section>
  );
}

/**
 * A parent paying a shop from the family wallet: scan, quote, pay, wait for
 * the shop. The same state machine as the kid's (`usePayShop`) on the
 * parent's actions, in the adult palette, with no lesson gate and no daily
 * limit.
 */
export function PayFlow(options: PayShopOptions = {}) {
  const { state, quote, pay, reset, changeAmount } = usePayShop({
    ...options,
    deps: { quoteShop, prepareShopPayment, submitShopPayment, getShopPaymentStatus, ...options.deps },
  });
  const [scanError, setScanError] = useState<string | null>(null);

  const onScan = useCallback(
    (qrString: string) => {
      setScanError(null);
      void quote(qrString, undefined, parseVietQrSummary(qrString).merchantLabel);
    },
    [quote],
  );
  const onScanError = useCallback((message: string) => setScanError(message), []);

  const header = (
    <header className="space-y-1">
      <h1 className="text-3xl text-forest">Pay a shop</h1>
      <p className="text-sm text-ink/60">Scan the shop&apos;s code, check the amount, and pay from the family wallet.</p>
    </header>
  );

  switch (state.step) {
    case "scan":
      return (
        <section className="space-y-6">
          {header}
          {scanError && (
            <p className="rounded-2xl bg-white px-4 py-3 text-base text-ink/80 ring-1 ring-sand-dark" role="status">
              {scanError}
            </p>
          )}
          <QrScanner onResult={onScan} onError={onScanError} tone="adult" />
          <HomeLink />
        </section>
      );

    case "quoting":
      return (
        <section className="space-y-6">
          {header}
          <ShopPayCard tone="adult" state="loading" merchant={state.merchantHint} message="Reading the code…" onPay={() => {}} onNotNow={reset} />
        </section>
      );

    case "needs-amount":
      return (
        <section className="space-y-6">
          {header}
          <ShopPayCard
            tone="adult"
            state="needs-amount"
            merchant={state.quote.merchant}
            currencyCode={state.quote.currency}
            onPay={() => {}}
            onNotNow={reset}
            onAmountSubmit={(amountLocal) => void quote(state.qrString, amountLocal, state.quote.merchant)}
          />
        </section>
      );

    case "ready":
    case "paying":
    case "failed":
      return (
        <section className="space-y-6">
          {header}
          <ShopPayCard
            tone="adult"
            state={state.step}
            merchant={state.quote.merchant}
            currencyCode={state.quote.currency}
            amountLocalDisplay={state.quote.amountLocalDisplay}
            amountUsd={state.quote.amountUsd}
            feeUsd={state.quote.feeUsd}
            totalUsd={state.quote.totalUsd}
            message={state.step === "ready" ? "Once it's paid, it's paid. Check the amount first." : state.message}
            onPay={() => void pay()}
            onNotNow={reset}
          />
        </section>
      );

    case "paid":
      return (
        <section className="space-y-6">
          <div className="space-y-2 rounded-[22px] bg-forest p-5 text-sand">
            <p className="font-display text-2xl text-white tabular-nums" role="status">
              {state.message}
            </p>
            <p className="text-sm text-sand/80">
              {state.quote.amountLocalDisplay} {state.quote.currency} · {state.quote.totalUsd.display} from the family wallet
            </p>
            {state.explorerUrl && (
              <a href={state.explorerUrl} target="_blank" rel="noreferrer" className="inline-block text-xs underline">
                Proof on Solana
              </a>
            )}
          </div>
          <Link href="/" className={PRIMARY}>
            Back home
          </Link>
        </section>
      );

    case "slow":
      return (
        <section className="space-y-6" aria-live="polite">
          <div className="space-y-2 rounded-[22px] border border-sand-dark bg-white p-5">
            <h2 className="text-xl text-forest">Still going</h2>
            <p className="text-ink/80" role="status">
              {state.message}
            </p>
          </div>
          <Link href="/" className={PRIMARY}>
            Back home
          </Link>
        </section>
      );

    case "stopped":
      return (
        <section className="space-y-6">
          {header}
          <StopCard message={state.message} onScanAgain={reset} onChangeAmount={state.wasStatic && state.quote ? changeAmount : undefined} />
        </section>
      );
  }
}
