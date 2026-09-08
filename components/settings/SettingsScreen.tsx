"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createFamily } from "@/app/family/actions";
import { enablePayments, getDeviceState, getSettingsState, renameFamily, setGuardianLabel, setKidPayments, type DeviceState, type SettingsState } from "@/app/settings/actions";
import { createWallet } from "@/app/wallet/actions";
import { PrimaryButton, RuleNotice, SecondaryButton } from "@/components/family/ui";
import { Avatar } from "@/components/kid/Avatar";
import { registerDevice } from "@/lib/device/actions";
import { getOrCreateDeviceKey, type DeviceKey } from "@/lib/device/key";
import { FAMILY_NAME_MAX, GUARDIAN_LABELS, validateFamilyName, type GuardianLabel } from "@/lib/settings/family";
import { GENDERS, ID_TYPES, KYC_TEST_DETAILS, validateKyc, type KycField, type KycInput } from "@/lib/shop/kyc";

const card = "space-y-3 rounded-[22px] border border-sand-dark bg-white p-5";
const field = "mt-1 block min-h-[44px] w-full rounded-xl border border-sand-dark bg-white px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-terracotta/40 disabled:opacity-60";
const choice = (selected: boolean) => `flex-1 cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold ${selected ? "border-terracotta bg-terracotta/10 text-terracotta-dark" : "border-sand-dark text-ink"}`;

type Outcome = { ok: boolean; error?: string };

const shortKey = (pubkey: string) => `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;

/**
 * Settings for whoever is signed in: the account, this device's key (and a
 * guardian's wallet), the family (start one, rename it, say who you are),
 * and, for guardians, opt-in shop payments: register with Sqril once, then
 * switch "Pay a shop" on per kid. Adult palette throughout.
 */
export function SettingsScreen({ initial }: { initial: SettingsState }) {
  const [state, setState] = useState(initial);
  const [key, setKey] = useState<DeviceKey | null>(null);
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  /** Run one action, show its outcome, then reload everything this screen shows. */
  async function run(label: string, fn: () => Promise<Outcome>, done?: string) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "That didn't work. Try again.");
      else if (done) setNotice(done);
    } catch {
      setError("That didn't work. Try again.");
    }
    setState(await getSettingsState());
    if (key) await refreshDevice(key);
    setBusy(null);
  }

  const role = state.kind === "guardian" ? (state.guardianLabel ?? "Parent") : state.kind === "kid" ? "Kid" : "No family yet";
  const homeHref = state.kind === "guardian" ? "/family" : state.kind === "kid" ? "/kid" : null;
  const deviceReady = Boolean(device?.registered);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <h1 className="text-3xl text-forest">Settings</h1>
        {homeHref && (
          <Link href={homeHref} className="text-sm font-semibold text-forest underline">
            {state.kind === "guardian" ? "Back to family" : "Back home"}
          </Link>
        )}
      </header>

      {error && <RuleNotice tone="problem">{error}</RuleNotice>}
      {notice && <RuleNotice>{notice}</RuleNotice>}

      <section className={card} aria-labelledby="account-heading">
        <h2 id="account-heading" className="text-xl text-forest">
          Account
        </h2>
        <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
          <dt className="text-ink/60">Email</dt>
          <dd className="break-all text-ink">{state.email ?? (state.kind === "kid" ? "None: a kid device signs in with its key" : "—")}</dd>
          <dt className="text-ink/60">Role</dt>
          <dd className="text-ink">{role}</dd>
        </dl>
        {state.kind === "kid" && <p className="text-xs text-ink/60">This device stays paired when you sign out. Sign back in and it still works.</p>}
        {/* Signing out keeps this device's key: it is the root of the account's wallets, and a lost root can never sign again (lib/device/key.ts). */}
        <form action="/logout" method="post">
          <SecondaryButton type="submit">Sign out</SecondaryButton>
        </form>
      </section>

      <section className={card} aria-labelledby="device-heading">
        <h2 id="device-heading" className="text-xl text-forest">
          This device
        </h2>
        {!key || !device ? (
          <p className="text-sm text-ink/70">Checking this device…</p>
        ) : state.kind === "kid" ? (
          device.registered ? (
            <Step done label={`Paired as ${state.kidName ?? "a kid"}`} />
          ) : (
            <>
              <Step done={false} label="This browser's key isn't the paired device" />
              <p className="text-sm text-ink/70">
                Ask a parent for a new code, then{" "}
                <Link href="/join" className="font-semibold text-forest underline">
                  join again
                </Link>
                .
              </p>
            </>
          )
        ) : (
          <>
            <Step done={device.registered} label="This device has its key">
              <SecondaryButton disabled={busy !== null} onClick={() => run("device", () => registerDevice(key.publicKey), "This device is set up.")}>
                {busy === "device" ? "Setting up…" : "Set up this device"}
              </SecondaryButton>
            </Step>
            <Step done={state.hasWallet} label={state.kind === "guardian" ? "Your wallet on Solana" : "Your wallet on Solana (it becomes the family wallet)"}>
              <SecondaryButton disabled={busy !== null || !device.deviceId} onClick={() => run("wallet", () => createWallet(device.deviceId!), "Your wallet is on Solana.")}>
                {busy === "wallet" ? "Creating on Solana…" : "Create my wallet"}
              </SecondaryButton>
            </Step>
            {state.hasWallet && device.onWallet === false && (
              <RuleNotice tone="problem">This key isn&apos;t on your wallet. The wallet was set up with another device&apos;s key, and only that key can sign for it. If that device is gone, ask us to move the wallet to this one.</RuleNotice>
            )}
            <p className="text-xs text-ink/50">Key {shortKey(key.publicKey)}. It never leaves this browser.</p>
          </>
        )}
      </section>

      {state.kind === "none" && (
        <>
          <section className={`${card} bg-sand-dark`}>
            <p className="text-sm text-forest">
              Joining as a kid?{" "}
              <Link href="/join" className="font-semibold underline">
                Open the invite email from a grown-up on this device
              </Link>
            </p>
          </section>
          <CreateFamilyForm ready={deviceReady && state.hasWallet} disabled={busy !== null} busy={busy === "family"} onSubmit={(input) => run("family", () => createFamily(input), "Your family is ready.")} />
        </>
      )}

      {state.kind === "guardian" && state.family && (
        <section className={card} aria-labelledby="family-heading">
          <h2 id="family-heading" className="text-xl text-forest">
            Family
          </h2>
          <RenameFamilyForm key={state.family.name} name={state.family.name} disabled={busy !== null} busy={busy === "rename"} onSubmit={(name) => run("rename", () => renameFamily(name), "Family renamed.")} />
          <fieldset>
            <legend className="text-sm font-semibold text-forest">You are the</legend>
            <div className="mt-1 flex gap-2">
              {GUARDIAN_LABELS.map((option) => (
                <label key={option} className={choice(state.guardianLabel === option)}>
                  <input
                    type="radio"
                    name="guardian-label"
                    value={option}
                    checked={state.guardianLabel === option}
                    disabled={busy !== null}
                    onChange={() => run("label", () => setGuardianLabel(option), `You are the ${option.toLowerCase()}.`)}
                    className="sr-only"
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-sm">
            <Link href="/settings/rules" className="font-semibold text-forest underline">
              Rules: each kid&apos;s limits and who they can send to
            </Link>
          </p>
          <p className="text-sm">
            <Link href="/family" className="font-semibold text-forest underline">
              Go to the family page
            </Link>
          </p>
        </section>
      )}

      {state.kind === "kid" && (
        <section className={card} aria-labelledby="family-heading">
          <h2 id="family-heading" className="text-xl text-forest">
            Family
          </h2>
          <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
            <dt className="text-ink/60">Family</dt>
            <dd className="text-ink">{state.family?.name ?? "—"}</dd>
            <dt className="text-ink/60">You</dt>
            <dd className="text-ink">{state.kidName ?? "—"}</dd>
          </dl>
          <p className="text-xs text-ink/60">A parent changes these from their phone.</p>
        </section>
      )}

      {state.kind === "guardian" && state.payments && (
        <PaymentsSection
          payments={state.payments}
          busy={busy}
          onEnable={(kyc) => run("payments", () => enablePayments(kyc), "Payments are on for this family. Switch them on for each kid below.")}
          onToggleKid={(kid, enabled) => run(`kid:${kid.id}`, () => setKidPayments(kid.id, enabled), enabled ? `${kid.name} can pay shops now.` : `${kid.name} can't pay shops any more.`)}
        />
      )}
    </div>
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

function CreateFamilyForm({ ready, disabled, busy, onSubmit }: { ready: boolean; disabled: boolean; busy: boolean; onSubmit: (input: { name: string; label: GuardianLabel }) => void }) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState<GuardianLabel>("Parent");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={card}
      onSubmit={(e) => {
        e.preventDefault();
        const check = validateFamilyName(name);
        if (!check.ok) {
          setError(check.error);
          return;
        }
        setError(null);
        onSubmit({ name: check.name, label });
      }}
    >
      <h2 className="text-xl text-forest">Start your family</h2>
      {!ready && <p className="text-sm text-ink/70">Set up this device and create your wallet first. Your wallet becomes the family wallet.</p>}
      <label htmlFor="family-name" className="block">
        <span className="text-sm font-semibold text-forest">Family name</span>
        <input id="family-name" className={`${field} text-lg`} value={name} onChange={(e) => setName(e.target.value)} maxLength={FAMILY_NAME_MAX} placeholder="The Tans" autoComplete="off" disabled={disabled} />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold text-forest">You are the</legend>
        <div className="mt-1 flex gap-2">
          {GUARDIAN_LABELS.map((option) => (
            <label key={option} className={choice(label === option)}>
              <input type="radio" name="label" value={option} checked={label === option} onChange={() => setLabel(option)} className="sr-only" disabled={disabled} />
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

function RenameFamilyForm({ name, disabled, busy, onSubmit }: { name: string; disabled: boolean; busy: boolean; onSubmit: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const changed = draft.trim() !== name;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const check = validateFamilyName(draft);
        if (!check.ok) {
          setError(check.error);
          return;
        }
        setError(null);
        onSubmit(check.name);
      }}
    >
      <label htmlFor="family-name" className="block">
        <span className="text-sm font-semibold text-forest">Family name</span>
        <input id="family-name" className={`${field} text-lg`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={FAMILY_NAME_MAX} autoComplete="off" disabled={disabled} />
      </label>
      {error && <RuleNotice tone="problem">{error}</RuleNotice>}
      <div className="flex justify-end">
        <SecondaryButton type="submit" disabled={disabled || !changed}>
          {busy ? "Renaming…" : "Rename"}
        </SecondaryButton>
      </div>
    </form>
  );
}

type PaymentsView = NonNullable<SettingsState["payments"]>;
type KidRow = PaymentsView["kids"][number];

function PaymentsSection({ payments, busy, onEnable, onToggleKid }: { payments: PaymentsView; busy: string | null; onEnable: (kyc: KycInput) => void; onToggleKid: (kid: KidRow, enabled: boolean) => void }) {
  const enabled = Boolean(payments.customerIdMasked);
  return (
    <section className={card} aria-labelledby="payments-heading">
      <h2 id="payments-heading" className="text-xl text-forest">
        Payments
      </h2>
      <p className="text-sm text-ink/70">Kids can pay shops by scanning a QR code: the money leaves their Spend jar and Sqril pays the shop in local currency. A parent registers as the sender first, then switches it on for each kid.</p>
      <p className="text-sm text-ink">
        Status: <span className="font-semibold text-forest">{enabled ? "Enabled for this family" : "Not enabled"}</span>
        {enabled && <span className="text-ink/60"> · Sqril customer {payments.customerIdMasked}</span>}
      </p>
      <RuleNotice>
        <p className="font-semibold">Staging only.</p>
        <p>Use test details, not a real identity.</p>
      </RuleNotice>
      {!enabled && <KycForm disabled={busy !== null} busy={busy === "payments"} onSubmit={onEnable} />}

      <div className="space-y-3 border-t border-sand-dark pt-4">
        <h3 className="text-base text-forest">Pay a shop</h3>
        {payments.kids.length === 0 && <p className="text-sm text-ink/60">Add a kid on the family page first.</p>}
        {payments.kids.map((kid) => (
          <KidPayToggle key={kid.id} kid={kid} disabled={busy !== null || !enabled} busy={busy === `kid:${kid.id}`} onChange={(next) => onToggleKid(kid, next)} />
        ))}
        {!enabled && payments.kids.length > 0 && <p className="text-xs text-ink/60">Switch on payments for the family first.</p>}
      </div>
    </section>
  );
}

function KidPayToggle({ kid, disabled, busy, onChange }: { kid: KidRow; disabled: boolean; busy: boolean; onChange: (enabled: boolean) => void }) {
  const on = kid.shopPayEnabled;
  return (
    <div className="flex items-center gap-3">
      <Avatar id={kid.avatarId} size="compact" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{kid.name}</p>
        <p className="text-xs text-ink/60">{busy ? "Saving…" : on ? "Can pay shops" : "Can't pay shops"}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`Pay a shop for ${kid.name}`}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${on ? "bg-forest" : "bg-sand-dark"}`}
      >
        <span aria-hidden className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

const KYC_EMPTY: KycInput = { fullName: "", dateOfBirth: "", gender: "", nationality: "", addressLine: "", city: "", postcode: "", country: "", idType: "", idNumber: "", idExpiry: "", phone: "", email: "" };

/** The parent's details for Sqril. Collapsed behind one button; the test details fill it in one tap. */
function KycForm({ disabled, busy, onSubmit }: { disabled: boolean; busy: boolean; onSubmit: (kyc: KycInput) => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<KycInput>(KYC_EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<KycField | null>(null);

  const set = (name: KycField) => (value: string) => setValues((v) => ({ ...v, [name]: value }));
  const bad = (name: KycField) => invalid === name;

  if (!open) {
    return (
      <div className="flex justify-end">
        <SecondaryButton type="button" onClick={() => setOpen(true)} disabled={disabled}>
          Set up payments
        </SecondaryButton>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateKyc(values);
    if (!check.ok) {
      setError(check.error);
      setInvalid(check.field);
      return;
    }
    setError(null);
    setInvalid(null);
    onSubmit(check.value);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-sand p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-forest">About the parent</p>
        <button type="button" onClick={() => setValues(KYC_TEST_DETAILS)} disabled={disabled} className="text-xs font-semibold text-forest underline">
          Fill in test details
        </button>
      </div>
      <TextField id="kyc-fullName" label="Full name" value={values.fullName} onChange={set("fullName")} invalid={bad("fullName")} disabled={disabled} autoComplete="name" />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="kyc-dateOfBirth" label="Date of birth" type="date" value={values.dateOfBirth} onChange={set("dateOfBirth")} invalid={bad("dateOfBirth")} disabled={disabled} autoComplete="bday" />
        <SelectField id="kyc-gender" label="Gender" value={values.gender} onChange={set("gender")} options={GENDERS} invalid={bad("gender")} disabled={disabled} />
      </div>
      <TextField id="kyc-nationality" label="Nationality" hint="Two-letter country code, like MY" value={values.nationality} onChange={set("nationality")} invalid={bad("nationality")} disabled={disabled} autoComplete="off" />
      <TextField id="kyc-addressLine" label="Address" value={values.addressLine} onChange={set("addressLine")} invalid={bad("addressLine")} disabled={disabled} autoComplete="address-line1" />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="kyc-city" label="City" value={values.city} onChange={set("city")} invalid={bad("city")} disabled={disabled} autoComplete="address-level2" />
        <TextField id="kyc-postcode" label="Postcode" value={values.postcode} onChange={set("postcode")} invalid={bad("postcode")} disabled={disabled} autoComplete="postal-code" />
      </div>
      <TextField id="kyc-country" label="Country" hint="Where they live, as a two-letter code" value={values.country} onChange={set("country")} invalid={bad("country")} disabled={disabled} autoComplete="country" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField id="kyc-idType" label="ID type" value={values.idType} onChange={set("idType")} options={ID_TYPES} invalid={bad("idType")} disabled={disabled} />
        <TextField id="kyc-idNumber" label="ID number" value={values.idNumber} onChange={set("idNumber")} invalid={bad("idNumber")} disabled={disabled} autoComplete="off" />
      </div>
      <TextField id="kyc-idExpiry" label="ID expiry" hint="Leave blank if it doesn't expire" type="date" value={values.idExpiry} onChange={set("idExpiry")} invalid={bad("idExpiry")} disabled={disabled} autoComplete="off" />
      <TextField id="kyc-phone" label="Phone" hint="With the country code, like +60 12 345 6789" type="tel" value={values.phone} onChange={set("phone")} invalid={bad("phone")} disabled={disabled} autoComplete="tel" />
      <TextField id="kyc-email" label="Email" type="email" value={values.email} onChange={set("email")} invalid={bad("email")} disabled={disabled} autoComplete="email" />
      {error && <RuleNotice tone="problem">{error}</RuleNotice>}
      <PrimaryButton type="submit" disabled={disabled}>
        {busy ? "Registering with Sqril…" : "Enable payments"}
      </PrimaryButton>
      <button
        type="button"
        onClick={() => {
          setValues(KYC_EMPTY);
          setError(null);
          setInvalid(null);
          setOpen(false);
        }}
        disabled={disabled}
        className="w-full text-sm text-ink/60 underline"
      >
        Not now
      </button>
    </form>
  );
}

function TextField({ id, label, hint, type = "text", value, onChange, invalid, disabled, autoComplete }: { id: string; label: string; hint?: string; type?: "text" | "date" | "tel" | "email"; value: string; onChange: (v: string) => void; invalid: boolean; disabled: boolean; autoComplete: string }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-semibold text-forest">{label}</span>
      {hint && <span className="block text-xs text-ink/60">{hint}</span>}
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={invalid || undefined} autoComplete={autoComplete} className={`${field} ${invalid ? "border-terracotta" : ""}`} />
    </label>
  );
}

function SelectField({ id, label, value, onChange, options, invalid, disabled }: { id: string; label: string; value: string; onChange: (v: string) => void; options: ReadonlyArray<{ value: string; label: string }>; invalid: boolean; disabled: boolean }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-semibold text-forest">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={invalid || undefined} className={`${field} ${invalid ? "border-terracotta" : ""}`}>
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
