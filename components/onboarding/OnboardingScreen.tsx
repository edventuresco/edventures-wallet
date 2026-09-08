"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createFamily } from "@/app/family/actions";
import { setDisplayName, type OnboardingState } from "@/app/onboarding/actions";
import { getDeviceState, type DeviceState } from "@/app/settings/actions";
import { createWallet } from "@/app/wallet/actions";
import { PrimaryButton, RuleNotice, SecondaryButton } from "@/components/family/ui";
import { registerDevice } from "@/lib/device/actions";
import { getOrCreateDeviceKey, type DeviceKey } from "@/lib/device/key";
import { DISPLAY_NAME_MAX, validateDisplayName } from "@/lib/onboarding/name";
import { FAMILY_NAME_MAX, GUARDIAN_LABELS, validateFamilyName, type GuardianLabel } from "@/lib/settings/family";

const card = "space-y-3 rounded-[22px] border border-sand-dark bg-white p-5";
const field = "mt-1 block min-h-[44px] w-full rounded-xl border border-sand-dark bg-white px-3 py-2 text-lg text-ink outline-none focus:ring-2 focus:ring-terracotta/40 disabled:opacity-60";
const choice = (selected: boolean) => `flex-1 cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold ${selected ? "border-terracotta bg-terracotta/10 text-terracotta-dark" : "border-sand-dark text-ink"}`;

type Outcome = { ok: boolean; error?: string };

/**
 * Three cards, top to bottom: your name, this device and your wallet, your
 * family. Each unlocks the next. When the family exists this account is a
 * guardian and home is /.
 */
export function OnboardingScreen({ initial }: { initial: OnboardingState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [key, setKey] = useState<DeviceKey | null>(null);
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshDevice = useCallback(async (k: DeviceKey) => setDevice(await getDeviceState(k.publicKey)), []);

  useEffect(() => {
    let cancelled = false;
    getOrCreateDeviceKey().then(async (k) => {
      if (cancelled) return;
      setKey(k);
      await refreshDevice(k);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshDevice]);

  async function run(label: string, fn: () => Promise<Outcome>, after?: () => void | Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "That didn't work. Try again.");
      else await after?.();
    } catch {
      setError("That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const named = Boolean(state.name);
  const deviceReady = Boolean(device?.registered);
  const walletReady = state.hasWallet;
  const done = [named, deviceReady && walletReady].filter(Boolean).length;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-4xl text-forest">Set up your wallet</h1>
        <p className="text-ink/80">Three short steps, then your family&apos;s home is ready.</p>
        <p className="text-sm text-ink/60">Step {Math.min(done + 1, 3)} of 3</p>
      </header>

      {error && <RuleNotice tone="problem">{error}</RuleNotice>}

      <NameCard name={state.name} disabled={busy !== null} busy={busy === "name"} onSubmit={(name) => run("name", () => setDisplayName(name), () => setState((s) => ({ ...s, name })))} />

      <section className={card} aria-labelledby="device-heading">
        <h2 id="device-heading" className="text-xl text-forest">
          2. This device and your wallet
        </h2>
        {!named ? (
          <p className="text-sm text-ink/70">Your name first.</p>
        ) : !key || !device ? (
          <p className="text-sm text-ink/70">Checking this device…</p>
        ) : (
          <>
            <Step done={device.registered} label="This device has its key">
              <SecondaryButton disabled={busy !== null} onClick={() => run("device", () => registerDevice(key.publicKey), () => refreshDevice(key))}>
                {busy === "device" ? "Setting up…" : "Set up this device"}
              </SecondaryButton>
            </Step>
            <Step done={walletReady} label="Your wallet on Solana (it becomes the family wallet)">
              <SecondaryButton disabled={busy !== null || !device.deviceId} onClick={() => run("wallet", () => createWallet(device.deviceId!), () => setState((s) => ({ ...s, hasWallet: true })))}>
                {busy === "wallet" ? "Creating on Solana…" : "Create my wallet"}
              </SecondaryButton>
            </Step>
            {walletReady && device.onWallet === false && (
              <RuleNotice tone="problem">This key isn&apos;t on your wallet. The wallet was set up with another device&apos;s key, and only that key can sign for it. If that device is gone, ask us to move the wallet to this one.</RuleNotice>
            )}
            <p className="text-xs text-ink/50">The key never leaves this browser.</p>
          </>
        )}
      </section>

      <FamilyCard
        ready={named && deviceReady && walletReady}
        disabled={busy !== null}
        busy={busy === "family"}
        onSubmit={(input) =>
          run(
            "family",
            () => createFamily(input),
            () => {
              router.push("/");
              router.refresh();
            },
          )
        }
      />

      <form action="/logout" method="post" className="text-center">
        <p className="text-sm text-ink/60">
          Signed in as {state.email ?? "you"}.{" "}
          <button type="submit" className="text-forest underline">
            Not you? Sign out
          </button>
        </p>
      </form>
    </main>
  );
}

function Step({ done, label, children }: { done: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-ink">
        <span aria-hidden className="mr-2">
          {done ? "✅" : "⬜️"}
        </span>
        {label}
      </p>
      {!done && children}
    </div>
  );
}

function NameCard({ name, disabled, busy, onSubmit }: { name: string | null; disabled: boolean; busy: boolean; onSubmit: (name: string) => void }) {
  const [draft, setDraft] = useState(name ?? "");
  const [editing, setEditing] = useState(!name);
  const [error, setError] = useState<string | null>(null);
  if (name && !editing) {
    return (
      <section className={card} aria-labelledby="name-heading">
        <h2 id="name-heading" className="text-xl text-forest">
          1. Your name
        </h2>
        <Step done label={`We'll call you ${name}`} />
        <button type="button" className="text-sm text-forest underline" onClick={() => setEditing(true)} disabled={disabled}>
          Change
        </button>
      </section>
    );
  }
  return (
    <form
      className={card}
      aria-labelledby="name-heading"
      onSubmit={(e) => {
        e.preventDefault();
        const check = validateDisplayName(draft);
        if (!check.ok) return setError(check.error);
        setError(null);
        setEditing(false);
        onSubmit(check.name);
      }}
    >
      <h2 id="name-heading" className="text-xl text-forest">
        1. Your name
      </h2>
      <label htmlFor="display-name" className="block">
        <span className="text-sm font-semibold text-forest">What should we call you?</span>
        <input id="display-name" className={field} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={DISPLAY_NAME_MAX} placeholder="Mark" autoComplete="given-name" disabled={disabled} />
      </label>
      <p className="text-xs text-ink/60">Your kids see this name on the family screen.</p>
      {error && <RuleNotice tone="problem">{error}</RuleNotice>}
      <PrimaryButton type="submit" disabled={disabled}>
        {busy ? "Saving…" : "That's me"}
      </PrimaryButton>
    </form>
  );
}

function FamilyCard({ ready, disabled, busy, onSubmit }: { ready: boolean; disabled: boolean; busy: boolean; onSubmit: (input: { name: string; label: GuardianLabel }) => void }) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState<GuardianLabel>("Parent");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={card}
      aria-labelledby="family-heading"
      onSubmit={(e) => {
        e.preventDefault();
        const check = validateFamilyName(name);
        if (!check.ok) return setError(check.error);
        setError(null);
        onSubmit({ name: check.name, label });
      }}
    >
      <h2 id="family-heading" className="text-xl text-forest">
        3. Your family
      </h2>
      {!ready && <p className="text-sm text-ink/70">Finish the steps above first. Your wallet becomes the family wallet.</p>}
      <label htmlFor="family-name" className="block">
        <span className="text-sm font-semibold text-forest">Family name</span>
        <input id="family-name" className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={FAMILY_NAME_MAX} placeholder="The Tans" autoComplete="off" disabled={disabled || !ready} />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold text-forest">You are the</legend>
        <div className="mt-1 flex gap-2">
          {GUARDIAN_LABELS.map((option) => (
            <label key={option} className={choice(label === option)}>
              <input type="radio" name="label" value={option} checked={label === option} onChange={() => setLabel(option)} className="sr-only" disabled={disabled || !ready} />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <RuleNotice tone="problem">{error}</RuleNotice>}
      <PrimaryButton type="submit" disabled={disabled || !ready}>
        {busy ? "Starting…" : "Start the family"}
      </PrimaryButton>
    </form>
  );
}
