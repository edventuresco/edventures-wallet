"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addContact, prepareRuleSync, removeContact, saveRuleChanges, submitRuleSync } from "@/app/family/rules/actions";
import { getOrCreateDeviceKey } from "@/lib/device/key";
import { unitsToDisplay } from "@/lib/money/usdc";
import { CONTACT_AVATAR_OPTIONS, validateNewContact } from "@/lib/rules/contacts";
import { DEFAULT_CONTACT_WEEKLY_UNITS } from "@/lib/rules/limits";
import { FIELD_LABELS, type LimitField, type MemberRulesView, type RuleChange, type RulesScreenProps } from "./contract";
import { MoneyField, PrimaryButton, RuleNotice, SecondaryButton, SyncChip } from "./ui";

/** Draft edits keyed by "limit:<kidId|guardian>:<field>" or "contact:<contactId>". */
type Drafts = Record<string, string>;

const limitKey = (kidId: string | null, field: LimitField) => `limit:${kidId ?? "guardian"}:${field}`;
const contactKey = (contactId: string) => `contact:${contactId}`;

/** "$50.00" -> "50.00": the field shows digits, the server parses them back. */
const bare = (display: string) => display.replace(/[$,]/g, "");

export function RulesScreen({ familyName, members }: RulesScreenProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Drafts>({});
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changes = toChanges(drafts, members);
  const dirty = changes.length > 0;

  function save() {
    setError(null);
    setNotices([]);
    startTransition(async () => {
      const result = await saveRuleChanges(changes);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDrafts({});
      setNotices(result.notices);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-forest">Rules</h1>
        <p className="mt-1 text-ink/70">{familyName}. Lowering a limit applies at once. Raising one applies four hours later.</p>
      </div>

      {members.map((m) => (
        <MemberCard
          key={m.kidId ?? "guardian"}
          member={m}
          drafts={drafts}
          disabled={pending}
          hasUnsaved={changes.some((c) => (c.kind === "limit" ? c.kidId === m.kidId : m.contacts.some((x) => x.id === c.contactId)))}
          onDraft={(k, v) => setDrafts((d) => ({ ...d, [k]: v }))}
          onSynced={() => router.refresh()}
        />
      ))}

      {error && <RuleNotice tone="problem">{error}</RuleNotice>}
      {notices.length > 0 && (
        <RuleNotice>
          <p className="font-semibold">Saved.</p>
          {notices.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </RuleNotice>
      )}

      <div className="fixed inset-x-0 bottom-0 bg-sand/95 px-5 pb-6 pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <PrimaryButton onClick={save} disabled={!dirty || pending}>
            {pending ? "Saving rules…" : dirty ? `Save ${changes.length === 1 ? "change" : `${changes.length} changes`}` : "No changes yet"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  drafts,
  disabled,
  hasUnsaved,
  onDraft,
  onSynced,
}: {
  member: MemberRulesView;
  drafts: Drafts;
  disabled: boolean;
  hasUnsaved: boolean;
  onDraft: (key: string, value: string) => void;
  onSynced: () => void;
}) {
  const [syncedUrl, setSyncedUrl] = useState<string | null>(null);
  const idBase = member.kidId ?? "guardian";
  const value = (field: LimitField, display: string) => drafts[limitKey(member.kidId, field)] ?? bare(display);
  const activeContacts = member.contacts.filter((c) => c.status !== "removed");
  const needsSync = member.kind === "kid" && member.hasDevice && (!member.onchainSynced || activeContacts.some((c) => c.status === "active" && !c.onchainSynced));

  return (
    <section className="space-y-4 rounded-[22px] border border-sand-dark bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {member.emoji}
        </span>
        <div className="flex-1">
          <h2 className="text-xl text-forest">{member.name}</h2>
          <p className="text-xs text-ink/60">{member.kind === "kid" ? "Spending wallet" : "Your daily ceiling, same rule as the kids"}</p>
        </div>
        <SyncChip synced={member.onchainSynced} />
      </div>

      {member.pending && (
        <RuleNotice>
          <p>
            {FIELD_LABELS[member.pending.field]} goes up to {member.pending.amount.display}. {member.pending.label}.
          </p>
        </RuleNotice>
      )}

      <div className="grid gap-3">
        <MoneyField id={`${idBase}-daily`} label="Daily limit" hint="The most this wallet can send in a day, across everyone." value={value("daily_limit_units", member.dailyLimit.display)} disabled={disabled} onChange={(v) => onDraft(limitKey(member.kidId, "daily_limit_units"), v)} />
        {member.weeklyLimit && (
          <MoneyField id={`${idBase}-weekly`} label="Weekly limit" hint="The most this wallet can send in a week." value={value("weekly_limit_units", member.weeklyLimit.display)} disabled={disabled} onChange={(v) => onDraft(limitKey(member.kidId, "weekly_limit_units"), v)} />
        )}
        {member.approvalThreshold && (
          <MoneyField id={`${idBase}-approval`} label="Approval threshold" hint="Sends above this wait for you to say yes." value={value("approval_threshold_units", member.approvalThreshold.display)} disabled={disabled} onChange={(v) => onDraft(limitKey(member.kidId, "approval_threshold_units"), v)} />
        )}
      </div>

      {member.kind === "kid" && (
        <div className="space-y-3 border-t border-sand-dark pt-4">
          <h3 className="text-base text-forest">People {member.name} can send to</h3>
          {activeContacts.length === 0 && <p className="text-sm text-ink/60">No one on the list yet.</p>}
          {activeContacts.map((c) => (
            <div key={c.id} className="flex items-end gap-3">
              <span className="pb-3 text-2xl" aria-hidden>
                {c.emoji}
              </span>
              <div className="flex-1">
                <MoneyField id={`${idBase}-contact-${c.id}`} label={`${c.label} · weekly limit`} hint={c.status === "requested" ? "Asked for, not approved yet" : undefined} value={drafts[contactKey(c.id)] ?? bare(c.weeklyLimit.display)} disabled={disabled} onChange={(v) => onDraft(contactKey(c.id), v)} />
              </div>
              <span className="flex flex-col items-end gap-1 pb-1">
                <SyncChip synced={c.onchainSynced} />
                <RemoveButton contactId={c.id} label={c.label} disabled={disabled} onRemoved={onSynced} />
              </span>
            </div>
          ))}
          {member.kidId && <AddContactForm kidId={member.kidId} kidName={member.name} disabled={disabled} onAdded={onSynced} />}
        </div>
      )}

      {needsSync && member.kidId && (
        <SyncPanel
          kidId={member.kidId}
          kidName={member.name}
          saving={disabled}
          hasUnsaved={hasUnsaved}
          onSynced={(url) => {
            setSyncedUrl(url);
            onSynced();
          }}
        />
      )}
      {!needsSync && syncedUrl && (
        <p className="text-sm text-forest">
          Rules are live on-chain.{" "}
          <a className="underline" href={syncedUrl} target="_blank" rel="noreferrer">
            See it on Solana
          </a>
        </p>
      )}
    </section>
  );
}

/** Quiet, per-row. The guardian sees the person vanish and an "Updating" chip until the chain agrees. */
function RemoveButton({ contactId, label, disabled, onRemoved }: { contactId: string; label: string; disabled: boolean; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const result = await removeContact(contactId);
      if (result.ok) onRemoved();
      else setError(result.error);
    } catch {
      setError("Couldn't remove them. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={remove} disabled={disabled || busy} aria-label={`Remove ${label}`} className="text-xs font-semibold text-ink/60 underline-offset-2 hover:underline disabled:opacity-60">
        {busy ? "Removing…" : "Remove"}
      </button>
      {error && <span className="text-xs text-terracotta-dark">{error}</span>}
    </>
  );
}

/** Compact "Add a person" form: name, picture, address, weekly cap. Collapsed until asked for. */
function AddContactForm({ kidId, kidName, disabled, onAdded }: { kidId: string; kidName: string; disabled: boolean; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [avatarId, setAvatarId] = useState("person");
  const [address, setAddress] = useState("");
  const [weeklyDollars, setWeeklyDollars] = useState(bare(unitsToDisplay(DEFAULT_CONTACT_WEEKLY_UNITS)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idBase = `${kidId}-new`;

  function reset() {
    setLabel("");
    setAvatarId("person");
    setAddress("");
    setWeeklyDollars(bare(unitsToDisplay(DEFAULT_CONTACT_WEEKLY_UNITS)));
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = { kidId, label, avatarId, address, weeklyDollars };
    const check = validateNewContact(input);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await addContact(input);
      if (result.ok) {
        reset();
        setOpen(false);
        onAdded();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Couldn't add them. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <SecondaryButton type="button" onClick={() => setOpen(true)} disabled={disabled}>
          Add a person
        </SecondaryButton>
      </div>
    );
  }

  const field = "mt-1 block min-h-[44px] w-full rounded-xl border border-sand-dark bg-white px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-terracotta/40";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-sand p-4">
      <p className="text-sm text-ink/70">Friends, family and shops. You need their Solana address; a kid can ask, but only you can add.</p>
      <label htmlFor={`${idBase}-label`} className="block">
        <span className="text-sm font-semibold text-forest">Name</span>
        <input id={`${idBase}-label`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={24} autoComplete="off" placeholder="Grandma" className={field} disabled={busy} />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold text-forest">Picture</legend>
        <div role="radiogroup" aria-label="Picture" className="mt-1 flex flex-wrap gap-1.5">
          {CONTACT_AVATAR_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={avatarId === option.id}
              aria-label={option.label}
              title={option.label}
              onClick={() => setAvatarId(option.id)}
              disabled={busy}
              className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${avatarId === option.id ? "bg-forest ring-2 ring-forest" : "bg-white ring-1 ring-sand-dark"}`}
            >
              {option.emoji}
            </button>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${idBase}-address`} className="block">
        <span className="text-sm font-semibold text-forest">Solana address</span>
        <span className="block text-xs text-ink/60">Paste the whole address from their wallet. Nothing shorter works.</span>
        <input id={`${idBase}-address`} aria-label="Solana address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Paste here" className={`${field} font-mono text-sm`} disabled={busy} />
      </label>
      <MoneyField id={`${idBase}-weekly`} label="Weekly limit" hint={`The most ${kidName} can send them in a week.`} value={weeklyDollars} disabled={busy} onChange={setWeeklyDollars} />
      {error && <RuleNotice tone="problem">{error}</RuleNotice>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={busy}
          className="min-h-[44px] px-4 text-sm font-semibold text-ink/60"
        >
          Cancel
        </button>
        <SecondaryButton type="submit" disabled={busy || disabled}>
          {busy ? "Adding…" : `Add to ${kidName}'s list`}
        </SecondaryButton>
      </div>
    </form>
  );
}

type SyncStage = "idle" | "preparing" | "signing" | "sending";

/** Saved rules that the chain has not seen yet. The guardian's device signs as root. */
function SyncPanel({ kidId, kidName, saving, hasUnsaved, onSynced }: { kidId: string; kidName: string; saving: boolean; hasUnsaved: boolean; onSynced: (explorerUrl: string) => void }) {
  const [stage, setStage] = useState<SyncStage>("idle");
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setError(null);
    try {
      setStage("preparing");
      const prepared = await prepareRuleSync(kidId);
      if (!prepared.ok) {
        setError(prepared.error);
        return;
      }
      setStage("signing");
      const key = await getOrCreateDeviceKey();
      const signedTxBase64 = await key.signTransaction(prepared.txBase64);
      setStage("sending");
      const submitted = await submitRuleSync({ kidId, token: prepared.token, signedTxBase64 });
      if (submitted.ok) onSynced(submitted.explorerUrl);
      else setError(submitted.error);
    } catch {
      setError("That didn't go through. The old rules are still in force; try again in a moment.");
    } finally {
      setStage("idle");
    }
  }

  const label = { idle: "Update on-chain", preparing: "Preparing…", signing: "Signing on this device…", sending: "Updating on Solana…" }[stage];

  return (
    <div className="space-y-3 border-t border-sand-dark pt-4">
      <RuleNotice>
        <p>{kidName}&apos;s saved rules are not on-chain yet. Until you update, the old rules are the ones the wallet follows.</p>
        {hasUnsaved && <p className="text-xs text-ink/70">Save your changes first, then update.</p>}
      </RuleNotice>
      <div className="flex justify-end">
        <SecondaryButton onClick={sync} disabled={saving || hasUnsaved || stage !== "idle"}>
          {label}
        </SecondaryButton>
      </div>
      {error && <RuleNotice tone="problem">{error}</RuleNotice>}
    </div>
  );
}

/** Only fields whose text differs from what the server rendered become changes. */
function toChanges(drafts: Drafts, members: MemberRulesView[]): RuleChange[] {
  const changes: RuleChange[] = [];
  for (const m of members) {
    const fields: Array<[LimitField, string | null]> = [
      ["daily_limit_units", m.dailyLimit.display],
      ["weekly_limit_units", m.weeklyLimit?.display ?? null],
      ["approval_threshold_units", m.approvalThreshold?.display ?? null],
    ];
    for (const [field, display] of fields) {
      if (display === null) continue;
      const draft = drafts[limitKey(m.kidId, field)];
      if (draft !== undefined && draft.trim() !== bare(display)) changes.push({ kind: "limit", kidId: m.kidId, field, dollars: draft.trim() });
    }
    for (const c of m.contacts) {
      const draft = drafts[contactKey(c.id)];
      if (draft !== undefined && draft.trim() !== bare(c.weeklyLimit.display)) changes.push({ kind: "contact", contactId: c.id, dollars: draft.trim() });
    }
  }
  return changes;
}
