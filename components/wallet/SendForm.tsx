"use client";

import { useState } from "react";
import type { DeviceKey } from "@/lib/device/key";
import { prepareTransfer, submitTransfer } from "@/app/wallet/actions";

export function SendForm({ deviceKey, onDone }: { deviceKey: DeviceKey; onDone: () => Promise<void> }) {
  const [to, setTo] = useState("");
  const [dollars, setDollars] = useState("");
  const [stage, setStage] = useState<"idle" | "preparing" | "signing" | "sending">("idle");
  const [result, setResult] = useState<{ kind: "ok"; url: string } | { kind: "error"; message: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    try {
      setStage("preparing");
      const prepared = await prepareTransfer({ devicePubkey: deviceKey.publicKey, to, dollars });
      if (!prepared.ok) {
        setResult({ kind: "error", message: prepared.error });
        return;
      }
      setStage("signing");
      const signed = await deviceKey.signTransaction(prepared.txBase64);
      setStage("sending");
      const submitted = await submitTransfer({ token: prepared.token, signedTxBase64: signed, to, dollars });
      setResult(submitted.ok ? { kind: "ok", url: submitted.explorerUrl } : { kind: "error", message: submitted.error });
      if (submitted.ok) {
        setTo("");
        setDollars("");
      }
    } catch {
      setResult({ kind: "error", message: "That didn't go through. Nothing was sent. Try again in a moment." });
    } finally {
      setStage("idle");
      await onDone();
    }
  }

  const label = { idle: "Send", preparing: "Preparing…", signing: "Signing on this device…", sending: "Sending…" }[stage];
  const input = "w-full rounded-2xl border border-sand-dark bg-white px-4 py-4 text-lg text-ink outline-none focus:ring-4 focus:ring-terracotta/35";

  return (
    <form onSubmit={send} className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-sand-dark">
      <h2 className="text-xl text-forest">Send</h2>
      <input aria-label="To (Solana address)" placeholder="To (Solana address)" value={to} onChange={(e) => setTo(e.target.value)} required className={input} />
      <input aria-label="Amount in dollars" placeholder="Amount, e.g. 2.50" inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value)} required className={input} />
      <button type="submit" disabled={stage !== "idle"} className="w-full rounded-2xl bg-terracotta px-6 py-4 text-lg font-semibold text-white disabled:opacity-60">
        {label}
      </button>
      {result?.kind === "ok" && (
        <p className="text-sm text-forest">
          Sent.{" "}
          <a className="underline" href={result.url} target="_blank" rel="noreferrer">
            See it on Solana
          </a>
        </p>
      )}
      {result?.kind === "error" && <p className="text-sm text-terracotta-dark">{result.message}</p>}
    </form>
  );
}
