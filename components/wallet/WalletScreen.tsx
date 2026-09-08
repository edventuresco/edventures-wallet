"use client";

import { useCallback, useEffect, useState } from "react";
import { getOrCreateDeviceKey, type DeviceKey } from "@/lib/device/key";
import { registerDevice } from "@/lib/device/actions";
import { createWallet, fundWallet, getWalletState, type WalletState } from "@/app/wallet/actions";
import { TEST_DOLLARS_LABEL } from "@/lib/money/test-dollars";
import { SendForm } from "./SendForm";

const button = "w-full rounded-2xl bg-terracotta px-6 py-4 text-lg font-semibold text-white disabled:opacity-60";

export function WalletScreen({ email }: { email: string | null }) {
  const [key, setKey] = useState<DeviceKey | null>(null);
  const [state, setState] = useState<WalletState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (k: DeviceKey | null) => {
    setState(await getWalletState(k?.publicKey ?? null));
  }, []);

  useEffect(() => {
    getOrCreateDeviceKey().then(async (k) => {
      setKey(k);
      await refresh(k);
    });
  }, [refresh]);

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(label);
    setError(null);
    try {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something didn't work. Try again.");
    } catch {
      setError("Something didn't work. Try again.");
    }
    await refresh(key);
    setBusy(null);
  }

  if (!key || !state) return <p className="text-ink/70">Getting this device ready…</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl text-forest">My wallet</h1>
        {/* Signing out keeps this device's key: it is the root of the wallet (lib/device/key.ts). */}
        <form action="/logout" method="post">
          <button className="text-sm text-forest underline">Sign out</button>
        </form>
      </header>
      <p className="text-sm text-ink/60">{email}</p>

      {!state.device && (
        <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-sand-dark">
          <h2 className="text-xl text-forest">Set up this device</h2>
          <p className="text-ink/80">This device gets its own key. It never leaves here, and there is nothing to write down.</p>
          <button className={button} disabled={busy !== null} onClick={() => run("device", () => registerDevice(key.publicKey))}>
            {busy === "device" ? "Setting up…" : "Set up this device"}
          </button>
        </section>
      )}

      {state.device && !state.wallet && (
        <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-sand-dark">
          <h2 className="text-xl text-forest">Create your wallet</h2>
          <p className="text-ink/80">Your wallet lives on Solana. This device is the key that controls it. We pay the fees.</p>
          <button className={button} disabled={busy !== null} onClick={() => run("wallet", () => createWallet(state.device!.id))}>
            {busy === "wallet" ? "Creating on Solana…" : "Create my wallet"}
          </button>
        </section>
      )}

      {state.wallet && (
        <>
          <section className="rounded-3xl bg-forest p-6 text-sand">
            <p className="text-sm">Balance</p>
            <p className="font-display text-5xl tabular-nums">{state.balance.display}</p>
            <a className="mt-2 inline-block text-xs underline" href={state.wallet.explorerUrl} target="_blank" rel="noreferrer">
              See it on Solana
            </a>
          </section>
          <button className={button} disabled={busy !== null} onClick={() => run("fund", fundWallet)}>
            {busy === "fund" ? "Adding…" : `Add ${TEST_DOLLARS_LABEL} of test dollars`}
          </button>
          <SendForm deviceKey={key} onDone={() => refresh(key)} />
        </>
      )}

      {error && <p className="rounded-xl bg-white p-3 text-sm text-terracotta-dark ring-1 ring-sand-dark">{error}</p>}

      {state.events.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl text-forest">What happened</h2>
          <ul className="space-y-2">
            {state.events.map((e) => (
              <li key={e.id} className="rounded-xl bg-white px-4 py-3 text-ink/80 ring-1 ring-sand-dark">
                {e.summary}
                {e.explorerUrl && (
                  <a className="ml-2 text-xs text-forest underline" href={e.explorerUrl} target="_blank" rel="noreferrer">
                    proof
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
