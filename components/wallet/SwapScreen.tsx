"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { getSwapState, prepareSwap, quoteSwap, submitSwap, type SwapQuoteView, type SwapState } from "@/app/swap/actions";
import { getOrCreateDeviceKey, type DeviceKey } from "@/lib/device/key";
import { sideLabels, type SwapDirection } from "@/lib/swap/amounts";

export type SwapDeps = {
  getSwapState: typeof getSwapState;
  quoteSwap: typeof quoteSwap;
  prepareSwap: typeof prepareSwap;
  submitSwap: typeof submitSwap;
  getDeviceKey: typeof getOrCreateDeviceKey;
};

const DEFAULT_DEPS: SwapDeps = { getSwapState, quoteSwap, prepareSwap, submitSwap, getDeviceKey: getOrCreateDeviceKey };

const input = "w-full rounded-2xl border border-sand-dark bg-white px-4 py-4 text-lg text-ink outline-none focus:ring-4 focus:ring-terracotta/35";
const primary = "w-full rounded-2xl bg-terracotta px-6 py-4 text-lg font-semibold text-white hover:bg-terracotta-dark disabled:opacity-60";
const quiet = "w-full rounded-2xl border border-forest px-6 py-3 text-base font-semibold text-forest hover:bg-sand-dark/40 disabled:opacity-60";

/**
 * Swap between the family's dollar and SOL. Amount in, quote back, then
 * one tap: the server builds the route, this device signs it, the fee
 * payer sends it. Jupiter on mainnet; a fixed-price stand-in on devnet.
 */
export function SwapScreen({ deps: partial }: { deps?: Partial<SwapDeps> } = {}) {
  const deps = { ...DEFAULT_DEPS, ...partial };
  const [key, setKey] = useState<DeviceKey | null>(null);
  const [state, setState] = useState<SwapState | null>(null);
  const [direction, setDirection] = useState<SwapDirection>("usdc_to_sol");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuoteView | null>(null);
  const [stage, setStage] = useState<"idle" | "quoting" | "preparing" | "signing" | "sending">("idle");
  const [result, setResult] = useState<{ kind: "ok"; url: string; summary: string } | { kind: "error"; message: string } | null>(null);

  const refresh = useCallback(async () => setState(await deps.getSwapState()), [deps.getSwapState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    deps.getDeviceKey().then(setKey);
    void refresh();
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  function flip() {
    setDirection((d) => (d === "usdc_to_sol" ? "sol_to_usdc" : "usdc_to_sol"));
    setQuote(null);
    setResult(null);
  }

  async function getQuote(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setQuote(null);
    setStage("quoting");
    try {
      const q = await deps.quoteSwap({ direction, amount });
      if (q.ok) setQuote(q);
      else setResult({ kind: "error", message: q.error });
    } catch {
      setResult({ kind: "error", message: "Couldn't get a price just now. Try again in a moment." });
    } finally {
      setStage("idle");
    }
  }

  async function swap() {
    if (!key || !quote) return;
    setResult(null);
    try {
      setStage("preparing");
      const prepared = await deps.prepareSwap({ devicePubkey: key.publicKey, direction, inputUnits: quote.inputUnits });
      if (!prepared.ok) return setResult({ kind: "error", message: prepared.error });
      setStage("signing");
      const signed = await key.signTransaction(prepared.txBase64);
      setStage("sending");
      const submitted = await deps.submitSwap({ token: prepared.token, signedTxBase64: signed, direction, inputUnits: quote.inputUnits });
      if (!submitted.ok) return setResult({ kind: "error", message: submitted.error });
      setResult({ kind: "ok", url: submitted.explorerUrl, summary: prepared.summary });
      setQuote(null);
      setAmount("");
    } catch {
      setResult({ kind: "error", message: "The swap didn't go through. Nothing moved. Try again in a moment." });
    } finally {
      setStage("idle");
      await refresh();
    }
  }

  const { from, to } = sideLabels(direction);
  const busy = stage !== "idle";
  const swapLabel = { idle: "Swap now", quoting: "Swap now", preparing: "Preparing…", signing: "Signing on this device…", sending: "Swapping…" }[stage];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl text-forest">Swap</h1>
        <p className="text-sm text-ink/60">
          {state?.provider === "jupiter" ? "Priced by Jupiter." : "Devnet: a fixed practice price, real on-chain moves."} Fees are on us.
        </p>
      </header>

      {state && !state.wallet && (
        <section className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5">
          <p className="text-ink/70">You need a wallet first. It takes one tap.</p>
          <Link href="/wallet" className="inline-block text-sm font-semibold text-forest underline">
            Create my wallet
          </Link>
        </section>
      )}

      {state?.wallet && (
        <>
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-forest p-4 text-sand">
              <p className="text-xs">USDC</p>
              <p className="font-display text-2xl tabular-nums text-white">{state.usdc.display}</p>
            </div>
            <div className="rounded-[22px] bg-forest p-4 text-sand">
              <p className="text-xs">SOL</p>
              <p className="font-display text-2xl tabular-nums text-white">{state.solDisplay}</p>
            </div>
          </section>

          <form onSubmit={getQuote} className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl text-forest">
                {from} to {to}
              </h2>
              <button type="button" onClick={flip} disabled={busy} aria-label={`Swap direction: ${to} to ${from}`} className="flex h-11 w-11 items-center justify-center rounded-full text-forest hover:bg-sand-dark/40">
                <ArrowDownUp size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <label className="block text-sm font-semibold text-forest" htmlFor="swap-amount">
              Amount in {from}
            </label>
            <input id="swap-amount" inputMode="decimal" placeholder={direction === "usdc_to_sol" ? "e.g. 2.50" : "e.g. 0.05"} value={amount} onChange={(e) => setAmount(e.target.value)} required className={input} />
            <button type="submit" disabled={busy || !amount} className={quiet}>
              {stage === "quoting" ? "Pricing…" : "Get a quote"}
            </button>

            {quote && (
              <div className="space-y-2 rounded-2xl bg-sand p-4 text-ink" aria-live="polite">
                <p className="flex justify-between">
                  <span className="text-ink/70">You give</span>
                  <span className="font-semibold tabular-nums">{quote.inputDisplay}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-ink/70">You get</span>
                  <span className="font-semibold tabular-nums">{quote.outputDisplay}</span>
                </p>
                <p className="text-xs text-ink/60">{quote.rate}. The final amount is set when you tap Swap now.</p>
                <button type="button" onClick={swap} disabled={busy || !key} className={primary}>
                  {swapLabel}
                </button>
              </div>
            )}
          </form>
        </>
      )}

      {result?.kind === "ok" && (
        <p className="rounded-2xl bg-white p-4 text-sm text-forest ring-1 ring-sand-dark" role="status">
          {result.summary}. Done.{" "}
          <a className="underline" href={result.url} target="_blank" rel="noreferrer">
            See it on Solana
          </a>
        </p>
      )}
      {result?.kind === "error" && (
        <p className="rounded-2xl bg-white p-4 text-sm text-terracotta-dark ring-1 ring-sand-dark" role="alert">
          {result.message}
        </p>
      )}
    </div>
  );
}
