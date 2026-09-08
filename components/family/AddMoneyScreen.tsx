"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AddMoneyContext } from "@/app/family/kids/[kidId]/actions";
import { prepareTransfer, submitTransfer } from "@/app/wallet/actions";
import { MoneyField, PrimaryButton, RuleNotice } from "@/components/family/ui";
import { getOrCreateDeviceKey, type DeviceKey } from "@/lib/device/key";

const QUICK = ["5", "10", "20"];

/**
 * A parent puts money into a kid's spend jar from the family wallet. Same
 * seam as every send: the server prepares the transfer, this device signs
 * it, the fee payer co-signs only what it prepared.
 */
export function AddMoneyScreen({ context }: { context: AddMoneyContext }) {
  const router = useRouter();
  const [key, setKey] = useState<DeviceKey | null>(null);
  const [dollars, setDollars] = useState("");
  const [stage, setStage] = useState<"idle" | "preparing" | "signing" | "sending">("idle");
  const [result, setResult] = useState<{ kind: "ok"; url: string; display: string } | { kind: "error"; message: string } | null>(null);

  useEffect(() => {
    getOrCreateDeviceKey().then(setKey);
  }, []);

  const ready = Boolean(key && context.spendAddress && context.familyBalance);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!key || !context.spendAddress) return;
    setResult(null);
    try {
      setStage("preparing");
      const prepared = await prepareTransfer({ devicePubkey: key.publicKey, to: context.spendAddress, dollars });
      if (!prepared.ok) return setResult({ kind: "error", message: prepared.error });
      setStage("signing");
      const signed = await key.signTransaction(prepared.txBase64);
      setStage("sending");
      const submitted = await submitTransfer({ token: prepared.token, signedTxBase64: signed, to: context.spendAddress, dollars });
      if (!submitted.ok) return setResult({ kind: "error", message: submitted.error });
      setResult({ kind: "ok", url: submitted.explorerUrl, display: `$${dollars.trim()}` });
      setDollars("");
      router.refresh();
    } catch {
      setResult({ kind: "error", message: "That didn't go through. Nothing was sent. Try again in a moment." });
    } finally {
      setStage("idle");
    }
  }

  const label = { idle: `Add to ${context.kid.name}'s spending`, preparing: "Preparing…", signing: "Signing on this device…", sending: "Sending on Solana…" }[stage];

  return (
    <div className="space-y-6">
      <Link href="/family" className="inline-flex items-center gap-1 text-sm text-forest">
        <span aria-hidden>←</span> Family
      </Link>
      <header className="space-y-1">
        <h1 className="text-3xl text-forest">Add money for {context.kid.name}</h1>
        <p className="text-ink/70">From the family wallet{context.familyBalance ? ` (${context.familyBalance.display})` : ""} into {context.kid.name}&apos;s spending. It lands on Solana in a moment.</p>
      </header>

      {!context.spendAddress && <RuleNotice tone="problem">{context.kid.name}&apos;s jars aren&apos;t on Solana yet. Add them from the Family page first.</RuleNotice>}
      {!context.familyBalance && <RuleNotice tone="problem">The family wallet isn&apos;t set up yet. Finish setup under Settings.</RuleNotice>}

      <form onSubmit={send} className="space-y-4 rounded-[22px] border border-sand-dark bg-white p-5">
        <MoneyField id="add-amount" label="Amount" value={dollars} onChange={setDollars} disabled={stage !== "idle" || !ready} />
        <div className="flex gap-2">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setDollars(q)} disabled={stage !== "idle" || !ready} className="rounded-xl border border-sand-dark px-4 py-2 text-sm font-semibold text-forest disabled:opacity-60">
              ${q}
            </button>
          ))}
        </div>
        <PrimaryButton type="submit" disabled={stage !== "idle" || !ready || !dollars.trim()}>
          {label}
        </PrimaryButton>
        {result?.kind === "ok" && (
          <RuleNotice>
            {result.display} is in {context.kid.name}&apos;s spending.{" "}
            <a className="underline" href={result.url} target="_blank" rel="noreferrer">
              See it on Solana
            </a>
          </RuleNotice>
        )}
        {result?.kind === "error" && <RuleNotice tone="problem">{result.message}</RuleNotice>}
      </form>
    </div>
  );
}
