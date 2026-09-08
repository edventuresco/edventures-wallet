"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AmountPad } from "@/components/kid/send/AmountPad";
import { ContactGrid, type SendContact } from "@/components/kid/send/ContactGrid";
import { KidAvatar } from "@/components/kid/send/KidAvatar";
import { SendFlow, type SendResult } from "@/components/kid/send/SendFlow";
import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";

export type ApprovedShare = { requestId: string; contactId: string; dollars: string };
export type PendingShare = { contactId: string; dollars: string };
export type RequestShareHandler = (contactId: string, dollars: string) => Promise<{ ok: true } | { ok: false; message: string }>;
export type ShareHandler = (contactId: string, dollars: string) => Promise<SendResult>;

const PRIMARY =
  "h-14 w-full rounded-2xl bg-kid-orange text-xl font-bold text-white transition-transform duration-150 ease-out active:translate-y-px disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none";
const QUIET = "inline-flex h-12 w-full items-center justify-center rounded-2xl text-lg font-semibold text-ink/60 hover:bg-white/60";

type Step =
  | { kind: "pick" }
  | { kind: "amount"; contact: SendContact }
  | { kind: "confirm"; contact: SendContact; dollars: string; busy: boolean; error?: string }
  | { kind: "asked"; contact: SendContact; dollars: string }
  | { kind: "share"; contactId: string; dollars: string };

function display(dollars: string): string {
  try {
    return unitsToDisplay(dollarsToUnits(dollars));
  } catch {
    return `$${dollars}`;
  }
}

/**
 * The Share jar: pick a person or cause from the list, pick an amount the
 * jar can cover, and ask. A guardian says yes every time; once they have,
 * one tap shares it through the same flow as a send, in share words.
 */
export function ShareScreen({
  contacts,
  shareDisplay,
  shareUnits,
  parentName,
  approvedShare,
  pendingShare,
  onRequest,
  onShare,
}: {
  contacts: SendContact[];
  shareDisplay: string;
  /** Share-jar balance in base units, as a string across the boundary. */
  shareUnits: string;
  parentName: string;
  approvedShare?: ApprovedShare;
  pendingShare?: PendingShare;
  onRequest: RequestShareHandler;
  /** Runs an approved share; the one-tap card shows only when this is wired. */
  onShare?: ShareHandler;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const approvedContact = approvedShare && contacts.find((c) => c.id === approvedShare.contactId);
  const pendingContact = pendingShare && contacts.find((c) => c.id === pendingShare.contactId);

  async function ask(contact: SendContact, dollars: string) {
    setStep({ kind: "confirm", contact, dollars, busy: true });
    let result: Awaited<ReturnType<RequestShareHandler>>;
    try {
      result = await onRequest(contact.id, dollars);
    } catch {
      result = { ok: false, message: "That didn't go through. Try again in a moment." };
    }
    setStep(result.ok ? { kind: "asked", contact, dollars } : { kind: "confirm", contact, dollars, busy: false, error: result.message });
  }

  switch (step.kind) {
    case "pick":
      return (
        <div className="space-y-6">
          <section className="rounded-3xl bg-kid-purple/15 px-6 py-6 text-center ring-1 ring-kid-purple/30">
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-kid-purple">
              <span aria-hidden="true">💝</span> Share jar
            </p>
            <p className="mt-1 font-display text-[44px] font-semibold leading-none tabular-nums text-ink">{shareDisplay}</p>
            <p className="mt-3 text-sm font-medium text-ink/70">Money in here is for giving. {parentName} says yes to every share.</p>
          </section>

          {approvedShare && approvedContact && onShare && (
            <section className="space-y-3 rounded-3xl bg-kid-sage/35 px-5 py-5" aria-labelledby="approved-share-heading">
              <div className="flex items-center gap-3">
                <KidAvatar avatarId={approvedContact.avatarId} label={approvedContact.label} size="standard" />
                <div>
                  <h2 id="approved-share-heading" className="font-display text-[22px] font-semibold leading-7 text-kid-green">
                    {parentName} said yes
                  </h2>
                  <p className="text-sm text-ink/70">Your share for {approvedContact.label} is ready to go.</p>
                </div>
              </div>
              <button type="button" onClick={() => setStep({ kind: "share", contactId: approvedShare.contactId, dollars: approvedShare.dollars })} className={PRIMARY}>
                Tap to share {display(approvedShare.dollars)} with {approvedContact.label}
              </button>
            </section>
          )}

          {pendingShare && pendingContact && (
            <p className="rounded-2xl bg-white px-4 py-3 text-base leading-6 text-ink/80 ring-1 ring-sand-dark" role="status">
              We asked {parentName} about {display(pendingShare.dollars)} for {pendingContact.label}. You&apos;ll see a yes here.
            </p>
          )}

          <ContactGrid
            contacts={contacts}
            showAskToAdd={false}
            intro="Who would you like to give to? Someone on your list."
            onPick={(id) => {
              const contact = contacts.find((c) => c.id === id);
              if (contact) setStep({ kind: "amount", contact });
            }}
          />

          <Link href="/kid" className={QUIET}>
            Back home
          </Link>
        </div>
      );

    case "amount":
      return (
        <AmountPad
          key={step.contact.id}
          title={`How much for ${step.contact.label}?`}
          hint={`Your share jar has ${shareDisplay}`}
          maxUnits={BigInt(shareUnits)}
          onBack={() => setStep({ kind: "pick" })}
          onConfirm={(dollars) => setStep({ kind: "confirm", contact: step.contact, dollars, busy: false })}
        />
      );

    case "confirm":
      return (
        <section className="space-y-6">
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-8 text-center ring-1 ring-sand-dark">
            <KidAvatar avatarId={step.contact.avatarId} label={step.contact.label} size="hero" />
            <h1 className="font-display text-[30px] font-semibold leading-9 text-ink tabular-nums">
              Share {display(step.dollars)} with {step.contact.label}?
            </h1>
            <p className="text-base text-ink/60">{parentName} says yes first. Then it goes.</p>
          </div>
          {step.error && (
            <p role="alert" className="rounded-2xl bg-white px-4 py-3 text-base leading-6 text-ink ring-1 ring-sand-dark">
              {step.error}
            </p>
          )}
          <div className="space-y-2">
            <button type="button" disabled={step.busy} onClick={() => ask(step.contact, step.dollars)} className={PRIMARY}>
              {step.busy ? "Asking…" : `Ask ${parentName}`}
            </button>
            <button type="button" disabled={step.busy} onClick={() => setStep({ kind: "amount", contact: step.contact })} className={QUIET}>
              Not now
            </button>
          </div>
        </section>
      );

    case "asked":
      return (
        <section className="space-y-6 rounded-3xl bg-kid-sage/35 px-6 py-8 text-center">
          <span aria-hidden="true" className="text-5xl leading-none">
            🦉
          </span>
          <h1 className="font-display text-[26px] font-semibold leading-8 text-kid-green">We asked {parentName}.</h1>
          <p className="text-base leading-6 text-ink/80">
            When they say yes, come back here and tap to share {display(step.dollars)} with {step.contact.label}.
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setStep({ kind: "pick" });
                router.refresh();
              }}
              className={PRIMARY}
            >
              Okay
            </button>
            <Link href="/kid" className={QUIET}>
              Back home
            </Link>
          </div>
        </section>
      );

    case "share":
      return (
        <SendFlow
          mode="share"
          contacts={contacts}
          dailyLeftUnits={BigInt(shareUnits)}
          parentName={parentName}
          start={{ contactId: step.contactId, dollars: step.dollars, sendNow: true }}
          onSend={onShare ?? (async () => ({ ok: false, message: "Sharing isn't switched on yet. Ask a grown-up to check back soon." }))}
          onHome={() => {
            setStep({ kind: "pick" });
            router.refresh();
          }}
        />
      );
  }
}
