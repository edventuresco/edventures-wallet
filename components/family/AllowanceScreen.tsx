"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { payAllowanceNow, prepareKeeperRole, saveAllowance, submitKeeperRole } from "@/app/family/allowance/actions";
import { getOrCreateDeviceKey } from "@/lib/device/key";
import type { MoneyView } from "@/lib/money/usdc";
import type { AllowanceScreenProps, KidAllowanceView } from "./contract";
import { MoneyField, PrimaryButton, RuleNotice, SecondaryButton } from "./ui";

const bare = (display: string) => display.replace(/[$,]/g, "");

export function AllowanceScreen({ familyName, kids, keeperEnabled, keeperWeeklyCap }: AllowanceScreenProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "info" | "problem"; text: string; explorerUrl?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isDirty = (kid: KidAllowanceView) => drafts[kid.id] !== undefined && drafts[kid.id].trim() !== bare(kid.amount.display);

  function save(kid: KidAllowanceView) {
    setMessage(null);
    setBusy(`save:${kid.id}`);
    startTransition(async () => {
      const result = await saveAllowance(kid.id, drafts[kid.id].trim());
      if (!result.ok) {
        setMessage({ tone: "problem", text: `${kid.name}: ${result.error}` });
        setBusy(null);
        return;
      }
      setDrafts((d) => {
        const next = { ...d };
        delete next[kid.id];
        return next;
      });
      setMessage({ tone: "info", text: `${kid.name}'s allowance is saved.` });
      setBusy(null);
      router.refresh();
    });
  }

  function payNow(kid: KidAllowanceView) {
    setMessage(null);
    setBusy(kid.id);
    startTransition(async () => {
      const result = await payAllowanceNow(kid.id);
      setMessage(result.ok ? { tone: "info", text: `${kid.name} got ${kid.amount.display}.` } : { tone: "problem", text: result.error });
      setBusy(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-forest">Allowance</h1>
        <p className="mt-1 text-ink/70">{familyName}. Paid every Monday morning. You can also pay now.</p>
      </div>

      {!keeperEnabled && (
        <KeeperCard
          weeklyCap={keeperWeeklyCap}
          onDone={(explorerUrl) => {
            setMessage({ tone: "info", text: "Automatic allowance is on. Mondays are handled from here.", explorerUrl });
            router.refresh();
          }}
          onRetryable={() => router.refresh()}
        />
      )}

      {kids.length === 0 && <p className="rounded-2xl bg-white p-5 text-ink/70 ring-1 ring-sand-dark">Add a kid to your family to set an allowance.</p>}

      {kids.map((kid) => (
        <section key={kid.id} className="space-y-4 rounded-[22px] border border-sand-dark bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {kid.emoji}
            </span>
            <div className="flex-1">
              <h2 className="text-xl text-forest">{kid.name}</h2>
              <p className="text-xs text-ink/60">{kid.age === null ? "Age not set" : `Age ${kid.age}`}</p>
            </div>
            <p className="font-display text-2xl tabular-nums text-forest">{kid.amount.display}</p>
          </div>

          <MoneyField
            id={`allowance-${kid.id}`}
            label="Every week"
            hint={kid.isDefault ? (kid.age === null ? "Suggested until you set an amount." : `Suggested: $${kid.age}, their age in dollars.`) : undefined}
            value={drafts[kid.id] ?? bare(kid.amount.display)}
            disabled={pending}
            onChange={(v) => setDrafts((d) => ({ ...d, [kid.id]: v }))}
          />

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-ink/60">Next payment</dt>
            <dd className="text-right text-forest">
              <time dateTime={kid.nextRunISO}>{kid.nextRunLabel}</time>
            </dd>
            <dt className="text-ink/60">Last paid</dt>
            <dd className="text-right text-forest">{kid.lastPaidLabel ?? "Not yet"}</dd>
          </dl>

          {isDirty(kid) ? (
            <div className="flex items-center justify-end gap-3">
              <p className="text-xs text-ink/60">Save the new amount first.</p>
              <PrimaryButton onClick={() => save(kid)} disabled={pending}>
                {busy === `save:${kid.id}` ? "Saving…" : "Save allowance"}
              </PrimaryButton>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3">
              {!keeperEnabled && <p className="text-xs text-ink/60">Turn on automatic allowance to pay now.</p>}
              <SecondaryButton onClick={() => payNow(kid)} disabled={pending || !keeperEnabled}>
                {busy === kid.id ? `Paying ${kid.name}…` : `Pay ${kid.amount.display} now`}
              </SecondaryButton>
            </div>
          )}
        </section>
      ))}

      {message && (
        <RuleNotice tone={message.tone}>
          <p>
            {message.text}
            {message.explorerUrl && (
              <>
                {" "}
                <a className="underline" href={message.explorerUrl} target="_blank" rel="noreferrer">
                  See it on Solana
                </a>
              </>
            )}
          </p>
        </RuleNotice>
      )}

    </div>
  );
}

type KeeperStage = "idle" | "preparing" | "signing" | "sending";

/**
 * One-time setup: this device (root on the family wallet) signs a rule that
 * lets Edventures Wallet's keeper key move up to the weekly cap for allowances.
 */
function KeeperCard({ weeklyCap, onDone, onRetryable }: { weeklyCap: MoneyView; onDone: (explorerUrl: string) => void; onRetryable: () => void }) {
  const [stage, setStage] = useState<KeeperStage>("idle");
  const [error, setError] = useState<string | null>(null);

  async function turnOn() {
    setError(null);
    try {
      setStage("preparing");
      const prepared = await prepareKeeperRole();
      if (!prepared.ok) {
        setError(prepared.error);
        // The server may have found the role already live and recorded it; a refresh shows the real state.
        onRetryable();
        return;
      }
      setStage("signing");
      const key = await getOrCreateDeviceKey();
      const signedTxBase64 = await key.signTransaction(prepared.txBase64);
      setStage("sending");
      const submitted = await submitKeeperRole({ token: prepared.token, signedTxBase64 });
      if (submitted.ok) onDone(submitted.explorerUrl);
      else {
        setError(submitted.error);
        onRetryable();
      }
    } catch {
      setError("That didn't go through. Nothing changed; try again in a moment.");
    } finally {
      setStage("idle");
    }
  }

  const label = { idle: "Turn on automatic allowance", preparing: "Preparing…", signing: "Signing on this device…", sending: "Updating on Solana…" }[stage];

  return (
    <section className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5 shadow-sm">
      <h2 className="text-xl text-forest">Turn on automatic allowance</h2>
      <p className="text-sm text-ink/70">
        Edventures Wallet pays each allowance from the family wallet every Monday morning. Turning this on signs one rule with this device: the app may move up to {weeklyCap.display} a week, and nothing else. You can pay now once it is on.
      </p>
      <div className="flex justify-end">
        <SecondaryButton onClick={turnOn} disabled={stage !== "idle"}>
          {label}
        </SecondaryButton>
      </div>
      {error && <RuleNotice tone="problem">{error}</RuleNotice>}
    </section>
  );
}
