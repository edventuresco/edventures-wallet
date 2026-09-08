"use client";

import { useState } from "react";
import type { MoneyView } from "@/lib/money/usdc";

export type ShopPayCardState = "loading" | "needs-amount" | "ready" | "paying" | "paid" | "failed";

/** Kid screens use the kid palette; a parent paying from the family wallet uses the adult one. */
export type ShopPayTone = "kid" | "adult";

const TONES: Record<ShopPayTone, { card: string; padKey: string; padGo: string; alert: string; pay: string }> = {
  kid: { card: "bg-kid-sun/20", padKey: "active:bg-kid-sage/30", padGo: "bg-kid-teal", alert: "text-kid-coral", pay: "bg-kid-orange" },
  adult: { card: "bg-white ring-1 ring-sand-dark", padKey: "active:bg-sand-dark/40", padGo: "bg-forest", alert: "text-terracotta-dark", pay: "bg-terracotta" },
};

export interface ShopPayCardProps {
  state: ShopPayCardState;
  /** Known once decode/quote returns; used for loading/needs-amount too. */
  merchant?: string;
  /** ISO 4217-ish code from the QR, e.g. "VND". Shown next to the number pad. */
  currencyCode?: string;
  /** Ready-to-render local amount, e.g. "79,000". Present once a quote exists. */
  amountLocalDisplay?: string;
  amountUsd?: MoneyView;
  feeUsd?: MoneyView;
  totalUsd?: MoneyView;
  /** Status/failure copy for the current state; the card never invents its own. */
  message?: string;
  payLabel?: string;
  onPay: () => void;
  onNotNow: () => void;
  /** Required when state is "needs-amount": the payer keyed in a local amount. */
  onAmountSubmit?: (amountLocal: number) => void;
  tone?: ShopPayTone;
}

/** Big on-screen digit pad; no native number input (mis-taps are costly here). */
function AmountPad({
  currencyCode,
  onSubmit,
  tone,
}: {
  currencyCode?: string;
  onSubmit: (amountLocal: number) => void;
  tone: ShopPayTone;
}) {
  const [digits, setDigits] = useState("");
  const amount = digits ? Number(digits) : 0;

  function press(digit: string) {
    if (digits.length >= 9) return; // absurdly large amount; corridor limits reject it anyway
    setDigits((d) => (d === "0" ? digit : d + digit));
  }

  function backspace() {
    setDigits((d) => d.slice(0, -1));
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <p className="font-display text-5xl text-ink">
        {digits ? amount.toLocaleString("en-US") : "0"}
        {currencyCode && <span className="ml-2 text-2xl text-ink/60">{currencyCode}</span>}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => press(digit)}
            className={`h-16 w-16 rounded-2xl bg-white text-2xl font-bold text-ink shadow-sm ${TONES[tone].padKey}`}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={backspace}
          aria-label="Delete last digit"
          className={`h-16 w-16 rounded-2xl bg-white text-xl font-bold text-ink shadow-sm ${TONES[tone].padKey}`}
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => press("0")}
          className={`h-16 w-16 rounded-2xl bg-white text-2xl font-bold text-ink shadow-sm ${TONES[tone].padKey}`}
        >
          0
        </button>
        <div />
      </div>

      <button
        type="button"
        onClick={() => onSubmit(amount)}
        disabled={amount <= 0}
        className={`w-full rounded-2xl ${TONES[tone].padGo} px-4 py-4 text-xl font-bold text-white disabled:opacity-40`}
      >
        Next
      </button>
    </div>
  );
}

/** Shows a shop quote and drives it to "Pay". No wallet or Sqril code here — a
 * parent component supplies the on-chain step and wires state transitions. */
export function ShopPayCard({
  state,
  merchant,
  currencyCode,
  amountLocalDisplay,
  amountUsd,
  feeUsd,
  totalUsd,
  message,
  payLabel = "Pay",
  onPay,
  onNotNow,
  onAmountSubmit,
  tone = "kid",
}: ShopPayCardProps) {
  return (
    <div className={`flex flex-col items-center gap-6 rounded-3xl ${TONES[tone].card} p-6 text-center`}>
      <p className="text-lg font-semibold text-ink/70">{merchant ?? "Loading shop…"}</p>

      {state === "loading" && (
        <p className="text-base text-ink/60">{message ?? "Reading the code…"}</p>
      )}

      {state === "needs-amount" && (
        <>
          <p className="text-base text-ink/60">How much are you paying?</p>
          <AmountPad
            currencyCode={currencyCode}
            onSubmit={(amountLocal) => onAmountSubmit?.(amountLocal)}
            tone={tone}
          />
        </>
      )}

      {(state === "ready" || state === "paying" || state === "paid" || state === "failed") && (
        <>
          <p className="font-display text-5xl text-ink">
            {amountLocalDisplay}
            {currencyCode && <span className="ml-2 text-2xl text-ink/60">{currencyCode}</span>}
          </p>

          <div className="w-full max-w-sm space-y-1 rounded-2xl bg-white p-4 text-left text-base text-ink/80">
            <div className="flex justify-between">
              <span>You send</span>
              <span className="font-semibold">{amountUsd?.display}</span>
            </div>
            <div className="flex justify-between">
              <span>Fee</span>
              <span className="font-semibold">{feeUsd?.display}</span>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-1 text-lg">
              <span>Total</span>
              <span className="font-bold">{totalUsd?.display}</span>
            </div>
          </div>

          {message && (
            <p
              className={
                state === "failed"
                  ? `text-base font-semibold ${TONES[tone].alert}`
                  : "text-base text-ink/70"
              }
              role={state === "failed" ? "alert" : undefined}
            >
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={onPay}
            disabled={state === "paying" || state === "paid"}
            className={`w-full max-w-sm rounded-2xl ${TONES[tone].pay} px-4 py-5 text-2xl font-bold text-white disabled:opacity-60`}
          >
            {state === "paying" ? "Paying…" : state === "paid" ? "Paid!" : state === "failed" ? "Try again" : payLabel}
          </button>
        </>
      )}

      {state !== "paid" && (
        <button
          type="button"
          onClick={onNotNow}
          className="text-base font-semibold text-ink/50 underline underline-offset-4"
        >
          Not now
        </button>
      )}
    </div>
  );
}
