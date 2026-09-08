"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { QrScanner } from "@/components/kid/QrScanner";
import { ShopPayCard } from "@/components/kid/ShopPayCard";
import { isLessonComplete } from "@/lib/lessons/storage";
import { parseVietQrSummary } from "@/lib/shop/vietqr";
import { usePayShop, type PayShopOptions } from "./usePayShop";

export const SHOP_LESSON_ID = "before-you-send";

const PRIMARY =
  "flex h-14 w-full items-center justify-center rounded-2xl bg-kid-orange text-xl font-bold text-white transition-transform duration-150 ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none";
const QUIET =
  "flex h-12 w-full items-center justify-center rounded-2xl text-lg font-semibold text-ink/60 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50";

function HomeLink() {
  return (
    <Link href="/kid" className={QUIET}>
      Back home
    </Link>
  );
}

/** The lesson gate: a warm ask, not a wall. */
function LessonGate({ onDone }: { onDone: () => void }) {
  const [notFound, setNotFound] = useState(false);
  function recheck() {
    if (isLessonComplete(SHOP_LESSON_ID)) onDone();
    else setNotFound(true);
  }
  return (
    <section className="space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-8 text-center ring-1 ring-sand-dark">
        <span aria-hidden="true" className="text-5xl leading-none">
          🦉
        </span>
        <h1 className="font-display text-[26px] font-semibold leading-8 text-kid-green">One quick thing first</h1>
        <p className="max-w-xs text-lg leading-7 text-ink">Before your first shop payment, do the 3-minute lesson.</p>
        {notFound && (
          <p className="max-w-xs text-sm leading-5 text-ink/60" aria-live="polite">
            We can&apos;t see that lesson finished yet. Open it and answer the question at the end.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Link href={`/learn/${SHOP_LESSON_ID}`} className={PRIMARY}>
          Do the lesson
        </Link>
        <button type="button" onClick={recheck} className={QUIET}>
          I&apos;ve done it
        </button>
        <HomeLink />
      </div>
    </section>
  );
}

/** A stop the kid cannot tap through: what happened, and the next step. */
function StopCard({ message, onScanAgain, onChangeAmount }: { message: string; onScanAgain: () => void; onChangeAmount?: () => void }) {
  return (
    <section className="space-y-6" aria-live="polite">
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-8 text-center ring-1 ring-sand-dark">
        <span aria-hidden="true" className="text-5xl leading-none">
          🦉
        </span>
        <h1 className="font-display text-[26px] font-semibold leading-8 text-kid-green">Not this time</h1>
        <p className="max-w-xs text-lg leading-7 text-ink" role="alert">
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

/** Kid "Pay a shop": lesson gate, scan, quote, pay, wait for the shop. */
export function PayShopFlow(options: PayShopOptions = {}) {
  const [lesson, setLesson] = useState<"checking" | "todo" | "done">("checking");
  useEffect(() => {
    // localStorage is only readable after mount; the server renders the neutral state.
    setLesson(isLessonComplete(SHOP_LESSON_ID) ? "done" : "todo");
  }, []);

  const { state, quote, pay, reset, changeAmount } = usePayShop(options);
  const [scanError, setScanError] = useState<string | null>(null);

  const onScan = useCallback(
    (qrString: string) => {
      setScanError(null);
      void quote(qrString, undefined, parseVietQrSummary(qrString).merchantLabel);
    },
    [quote],
  );
  const onScanError = useCallback((message: string) => setScanError(message), []);

  if (lesson === "checking") {
    return <p className="py-16 text-center text-base text-ink/60">Just a moment…</p>;
  }
  if (lesson === "todo") {
    return <LessonGate onDone={() => setLesson("done")} />;
  }

  const header = (
    <header className="space-y-1">
      <h1 className="font-display text-[30px] font-semibold leading-9 text-kid-green">Pay a shop</h1>
      <p className="text-base text-ink/70">The shop shows a code. You scan it, check the amount, and tap Pay.</p>
    </header>
  );

  switch (state.step) {
    case "scan":
      return (
        <section className="space-y-6">
          {header}
          {scanError && (
            <p className="rounded-2xl bg-white px-4 py-3 text-base text-ink/80" role="status">
              {scanError}
            </p>
          )}
          <QrScanner onResult={onScan} onError={onScanError} />
          <HomeLink />
        </section>
      );

    case "quoting":
      return (
        <section className="space-y-6">
          {header}
          <ShopPayCard state="loading" merchant={state.merchantHint} message="Reading the code…" onPay={() => {}} onNotNow={reset} />
        </section>
      );

    case "needs-amount":
      return (
        <section className="space-y-6">
          {header}
          <ShopPayCard
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
          <div className="flex animate-leaf-lift flex-col items-center gap-5 rounded-3xl bg-kid-sage/35 px-6 py-10 text-center motion-reduce:animate-none">
            <span aria-hidden="true" className="text-6xl leading-none">
              ✅
            </span>
            <p className="font-display text-[30px] font-semibold leading-9 text-kid-green tabular-nums" role="status">
              {state.message}
            </p>
            <p className="text-base text-ink/70">
              {state.quote.amountLocalDisplay} {state.quote.currency} · {state.quote.totalUsd.display} from your Spend jar
            </p>
          </div>
          <Link href="/kid" className={PRIMARY}>
            Back home
          </Link>
          {state.explorerUrl && (
            <p className="text-center">
              <a href={state.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-ink/45 underline-offset-2 hover:underline">
                <span aria-hidden="true">🔎</span> Proof for grown-ups
              </a>
            </p>
          )}
        </section>
      );

    case "slow":
      return (
        <section className="space-y-6" aria-live="polite">
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-8 text-center ring-1 ring-sand-dark">
            <span aria-hidden="true" className="text-5xl leading-none">
              ⏳
            </span>
            <h1 className="font-display text-[26px] font-semibold leading-8 text-kid-green">Still going</h1>
            <p className="max-w-xs text-lg leading-7 text-ink" role="status">
              {state.message}
            </p>
          </div>
          <Link href="/kid" className={PRIMARY}>
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
