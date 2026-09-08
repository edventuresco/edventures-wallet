"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { addKid, getFamilyState, inviteKid, prepareApproveDevice, submitApproveDevice, type FamilyState } from "@/app/family/actions";
import { Avatar } from "@/components/kid/Avatar";
import { AvatarPicker } from "@/components/kid/AvatarPicker";
import { PrimaryButton, RuleNotice, SecondaryButton } from "@/components/family/ui";
import { getOrCreateDeviceKey, type DeviceKey } from "@/lib/device/key";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import { possessive } from "@/lib/family/owner";

type Kid = FamilyState["kids"][number];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const card = "space-y-3 rounded-[22px] border border-sand-dark bg-white p-5";
const field = "mt-1 block min-h-[44px] w-full rounded-xl border border-sand-dark bg-white px-3 py-2 text-lg text-ink outline-none focus:ring-2 focus:ring-terracotta/40";

/**
 * The guardian's family home: get this device and the family wallet ready,
 * start the family, add kids, pair their devices, and approve them by
 * signing the on-chain role with this device's key.
 */
export function FamilySetup({ initial, feed }: { initial: FamilyState; feed?: React.ReactNode }) {
  const [state, setState] = useState(initial);
  const [key, setKey] = useState<DeviceKey | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addingKid, setAddingKid] = useState(false);

  const refresh = useCallback(async () => {
    setState(await getFamilyState());
  }, []);

  useEffect(() => {
    getOrCreateDeviceKey().then(setKey);
  }, []);

  // While an invite is out or a device is waiting, keep the page current without a reload.
  const waiting = state.kids.some((k) => k.devices.some((d) => d.status === "pending") || (k.invite && !k.invite.accepted));
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [waiting, refresh]);

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "That didn't work. Try again.");
    } catch {
      setError("That didn't work. Try again.");
    }
    await refresh();
    setBusy(null);
  }

  if (!key) return <p className="text-ink/70">Getting this device ready…</p>;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl text-forest">{state.family ? `${possessive(state.family.name)} family overview` : "Your family"}</h1>
        {state.guardianLabel && <p className="text-sm text-ink/60">You are the {state.guardianLabel.toLowerCase()}. Allowance and requests are below; rules live under Settings.</p>}
      </header>

      {error && <RuleNotice tone="problem">{error}</RuleNotice>}
      {notice && <RuleNotice>{notice}</RuleNotice>}

      {!state.family && (
        <section className={card}>
          <p className="text-ink/80">
            Starting a family lives in{" "}
            <Link href="/settings" className="font-semibold text-forest underline">
              Settings
            </Link>
            . Joining as a kid happens from a parent&apos;s invite email.
          </p>
        </section>
      )}

      {state.family && (
        <>
          {state.familyWallet && state.familyBalance && (
            <section className="rounded-[22px] bg-forest p-5 text-sand">
              <p className="text-sm">Family balance</p>
              <p className="font-display text-4xl tabular-nums text-white">{state.familyBalance.total.display}</p>
              <p className="mt-1 text-xs text-sand/70">
                Family wallet {state.familyWallet.balance.display} · kids&apos; jars {state.familyBalance.kids.display}. Allowances come from the family wallet.{" "}
                <Link href="/wallet" className="underline">
                  Add test dollars
                </Link>
              </p>
            </section>
          )}

          {state.pendingApprovals.map((p) => (
            <section key={p.deviceId} className={`${card} ring-2 ring-terracotta/40`}>
              <h2 className="text-xl text-forest">{p.kidName}&apos;s device is waiting for you</h2>
              <p className="text-sm text-ink/70">Approving signs the rules with this device: who {p.kidName} can send to, and the daily limit. It goes on-chain in one transaction.</p>
              <PrimaryButton
                disabled={busy !== null}
                onClick={() =>
                  run("approve", async () => {
                    const prepared = await prepareApproveDevice(p.deviceId);
                    if (!prepared.ok) return prepared;
                    const signed = await key.signTransaction(prepared.txBase64);
                    const submitted = await submitApproveDevice({ deviceId: p.deviceId, token: prepared.token, signedTxBase64: signed });
                    if (submitted.ok) setNotice(`${p.kidName}'s device is paired and the rules are live on Solana.`);
                    return submitted;
                  })
                }
              >
                {busy === "approve" ? "Signing and sending…" : `Approve ${p.kidName}'s device`}
              </PrimaryButton>
            </section>
          ))}

          <nav aria-label="Manage" className="grid grid-cols-2 gap-3">
            <Link href="/family/allowance" className={`${card} text-center font-semibold text-forest`}>
              Allowance
            </Link>
            <Link href="/family/requests" className={`${card} text-center font-semibold text-forest`}>
              Requests
            </Link>
          </nav>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl text-forest">Kids</h2>
              {!addingKid && (
                <SecondaryButton onClick={() => setAddingKid(true)} disabled={busy !== null}>
                  Add a kid
                </SecondaryButton>
              )}
            </div>
            {addingKid && (
              <AddKidForm
                busy={busy === "kid"}
                disabled={busy !== null}
                onCancel={() => setAddingKid(false)}
                onSubmit={(input) => {
                  setAddingKid(false);
                  void run("kid", () => addKid(input));
                }}
              />
            )}
            {state.kids.length === 0 && !addingKid && <p className="text-ink/70">No kids yet. Add one; each kid gets three wallets: spend, save and share.</p>}
            {state.kids.map((kid) => (
              <KidCard
                key={kid.id}
                kid={kid}
                busy={busy}
                onInvite={(email) =>
                  run(`invite:${kid.id}`, async () => {
                    const result = await inviteKid({ kidId: kid.id, email });
                    if (result.ok) setNotice(`Invite sent to ${result.email}. ${kid.name} opens it on their own device and lands in the family.`);
                    return result;
                  })
                }
              />
            ))}
          </section>

          {feed}
        </>
      )}
    </div>
  );
}

function KidCard({ kid, busy, onInvite }: { kid: Kid; busy: string | null; onInvite: (email: string) => void }) {
  const active = kid.devices.find((d) => d.status === "active");
  const pending = kid.devices.find((d) => d.status === "pending");
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const chip = active ? "Paired" : pending?.joined ? "Waiting for you" : kid.invite && !kid.invite.accepted ? "Invited" : "No device";
  return (
    <article className={card}>
      <div className="flex items-center gap-3">
        <Avatar id={kid.avatarId} size="standard" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-ink">
            <Link href={`/family/kids/${kid.id}`} className="underline-offset-2 hover:underline">
              {kid.name}
            </Link>
            {kid.age !== null && <span className="ml-2 text-sm font-normal text-ink/60">{kid.age}</span>}
          </p>
          <p className="text-xs text-ink/60">{kid.allowance ? `Allowance ${kid.allowance.display} a week` : "No allowance yet"}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-sage/20 text-forest" : "bg-sand-dark text-ink/70"}`}>{chip}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/family/kids/${kid.id}`} className="rounded-xl bg-sand px-3 py-2 text-left">
          <span className="block text-xs uppercase tracking-wide text-ink/60">Spending</span>
          <span className="block text-lg font-semibold tabular-nums text-ink">{kid.balances.spend.display}</span>
        </Link>
        <Link href={`/family/kids/${kid.id}`} className="rounded-xl bg-sand px-3 py-2 text-left">
          <span className="block text-xs uppercase tracking-wide text-ink/60">Savings</span>
          <span className="block text-lg font-semibold tabular-nums text-ink">{kid.balances.save.display}</span>
        </Link>
      </div>
      <Link href={`/family/kids/${kid.id}/add`} className="block rounded-xl border border-forest/30 px-4 py-2 text-center text-sm font-semibold text-forest">
        Add money
      </Link>
      {!active && !pending?.joined && kid.invite && !kid.invite.accepted && !inviting && (
        <p className="text-sm text-ink/70">
          Invited <span className="font-semibold">{kid.invite.email}</span>. When {kid.name} opens the email on their device, they join the family and this page updates.{" "}
          <button type="button" className="underline" onClick={() => setInviting(true)}>
            Send again
          </button>
        </p>
      )}
      {!active && !pending?.joined && (inviting || !kid.invite || kid.invite.accepted) && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onInvite(email);
            setInviting(false);
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold text-forest">Invite {kid.name} by email</span>
            <span className="block text-xs text-ink/60">Their own email, or yours with +{kid.name.toLowerCase()} before the @. The link opens on their device.</span>
            <input type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder={`mum+${kid.name.toLowerCase()}@gmail.com`} />
          </label>
          <SecondaryButton type="submit" disabled={busy !== null || !email.includes("@")}>
            {busy === `invite:${kid.id}` ? "Sending…" : "Send the invite"}
          </SecondaryButton>
        </form>
      )}
    </article>
  );
}

function AddKidForm({ busy, disabled, onCancel, onSubmit }: { busy: boolean; disabled: boolean; onCancel: () => void; onSubmit: (input: { name: string; avatarId: string; birthMonth: number; birthYear: number }) => void }) {
  const thisYear = new Date().getFullYear();
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [birthMonth, setBirthMonth] = useState(1);
  const [birthYear, setBirthYear] = useState(thisYear - 9);
  return (
    <form
      className={card}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, avatarId, birthMonth, birthYear });
        setName("");
      }}
    >
      <h2 className="text-xl text-forest">Add a kid</h2>
      <label className="block">
        <span className="text-sm font-semibold text-forest">Name</span>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-forest">Birth month</span>
          <select className={field} value={birthMonth} onChange={(e) => setBirthMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-forest">Birth year</span>
          <select className={field} value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))}>
            {Array.from({ length: 18 }, (_, i) => thisYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-ink/60">Allowance starts at their age in dollars a week. You can change it in Allowance.</p>
      <div>
        <span className="text-sm font-semibold text-forest">Avatar</span>
        <AvatarPicker value={avatarId} onChange={setAvatarId} className="mt-2" />
      </div>
      <PrimaryButton type="submit" disabled={disabled || !name.trim()}>
        {busy ? "Creating three wallets on Solana…" : "Add kid"}
      </PrimaryButton>
      <button type="button" className="w-full text-sm text-ink/60 underline" onClick={onCancel}>
        Not now
      </button>
    </form>
  );
}
