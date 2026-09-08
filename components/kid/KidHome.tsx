"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/kid/Avatar";
import { KidAvatar } from "@/components/kid/send/KidAvatar";
import { SendFlow, type SendResult, type SendStart } from "@/components/kid/send/SendFlow";
import { NameYourOwl, OwlButton } from "@/components/owl/OwlButton";
import { useOwl } from "@/components/owl/useOwl";
import type { KidHomeView } from "@/lib/family/kid-home";
import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";
import type { OwlContext } from "@/lib/owl/intent";

export type SendHandler = (contactId: string, dollars: string) => Promise<SendResult>;

/** A send a guardian has already said yes to; one tap sends it. */
export type ApprovedSend = { requestId: string; contactId: string; dollars: string };
/** A share from the share jar a guardian has said yes to; one tap shares it. */
export type ApprovedShare = { requestId: string; contactId: string; dollars: string };

/** Server action that files an add-contact request under the kid's name for the person. */
export type AskToAddHandler = (name: string) => Promise<{ ok: true; label: string } | { ok: false; error: string }>;

/** Until the kid send action is wired, every send stops here with a plain reason. */
async function sendNotReady(): Promise<SendResult> {
  return { ok: false, message: "Sending isn't switched on yet. Ask a grown-up to check back soon." };
}

const JAR_STYLE = {
  save: { label: "Save", emoji: "🎯", surface: "bg-kid-teal/15 ring-kid-teal/30", text: "text-kid-blue" },
  share: { label: "Share", emoji: "💝", surface: "bg-kid-purple/15 ring-kid-purple/30", text: "text-kid-purple" },
} as const;

const PRIMARY =
  "h-14 w-full rounded-2xl bg-kid-orange text-xl font-bold text-white transition-transform duration-150 ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none";

function safeDisplay(dollars: string): string {
  try {
    return unitsToDisplay(dollarsToUnits(dollars));
  } catch {
    return `$${dollars}`;
  }
}

/**
 * The kid home: big spend balance, the allowance on its way, the other two
 * jars, one Send button, what happened lately, and the owl at the bottom.
 * Tapping Send swaps the whole screen for the Send flow; coming back
 * refreshes the balances. `onSend` is the server action for a kid send;
 * without it the flow explains that sending is not ready yet.
 */
export function KidHome({
  view,
  onSend,
  onAskToAdd,
  onNameOwl,
  approvedSend,
  approvedShare,
  onShare,
}: {
  view: KidHomeView;
  onSend?: SendHandler;
  /** Runs an approved share from the share jar; the card shows only when both this and approvedShare are given. */
  onShare?: SendHandler;
  approvedShare?: ApprovedShare;
  /** Files the kid's request; without it the ask tile just explains that a parent adds people. */
  onAskToAdd?: AskToAddHandler;
  /** Server action that saves the owl's name; the first-run sheet shows only when this is given. */
  onNameOwl?: (name: string) => Promise<{ ok: boolean }>;
  approvedSend?: ApprovedSend;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<{ kind: "home" } | { kind: "send"; start?: SendStart; mode?: "send" | "share" } | { kind: "ask" }>({ kind: "home" });
  const [askNote, setAskNote] = useState(false);
  const [askName, setAskName] = useState("");
  const [askState, setAskState] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "error"; text: string } | { kind: "asked"; label: string }>({ kind: "idle" });
  const [lastBlockedReason, setLastBlockedReason] = useState(view.lastBlockedReason);
  const [owlSheetDismissed, setOwlSheetDismissed] = useState(false);
  const [nameRejected, setNameRejected] = useState(false);

  const owlContext: OwlContext = {
    kidName: view.kid.name,
    owlName: view.kid.owlName,
    balanceDisplay: view.jars.spend,
    contacts: view.contacts.map((c) => ({ id: c.id, label: c.label })),
    jarBalanceDisplay: view.jars.save,
    lastBlockedReason,
  };
  const owl = useOwl(owlContext);
  const proposal = owl.lastIntent?.kind === "propose_send" ? owl.lastIntent : null;
  const proposedContact = proposal && view.contacts.find((c) => c.id === proposal.contactId);
  const approvedContact = approvedSend && view.contacts.find((c) => c.id === approvedSend.contactId);
  const approvedShareContact = approvedShare && onShare && view.contacts.find((c) => c.id === approvedShare.contactId);

  function goHome() {
    setScreen({ kind: "home" });
    router.refresh();
  }

  if (screen.kind === "send") {
    const share = screen.mode === "share";
    return (
      <SendFlow
        contacts={view.contacts}
        dailyLeftUnits={BigInt(view.dailyLeftUnits)}
        parentName={view.parentLabel}
        start={screen.start}
        mode={screen.mode}
        onSend={share ? (onShare ?? sendNotReady) : (onSend ?? sendNotReady)}
        onResult={(result) => {
          if (!result.ok && !result.needsApproval) setLastBlockedReason(result.message);
        }}
        onAskToAdd={() => {
          if (onAskToAdd) {
            setAskName("");
            setAskState({ kind: "idle" });
            setScreen({ kind: "ask" });
          } else {
            setAskNote(true);
            setScreen({ kind: "home" });
          }
        }}
        onHome={goHome}
      />
    );
  }

  if (screen.kind === "ask" && onAskToAdd) {
    const busy = askState.kind === "busy";
    if (askState.kind === "asked") {
      return (
        <section className="space-y-6 rounded-3xl bg-kid-sage/35 px-6 py-8 text-center">
          <span aria-hidden="true" className="text-5xl leading-none">
            🦉
          </span>
          <h1 className="font-display text-[26px] font-semibold leading-8 text-kid-green">We asked {view.parentLabel}.</h1>
          <p className="text-base leading-6 text-ink/80">
            {view.parentLabel} can add {askState.label} from their phone. You&apos;ll see them on your list once that&apos;s done.
          </p>
          <button type="button" onClick={goHome} className={PRIMARY}>
            Back home
          </button>
        </section>
      );
    }
    return (
      <form
        className="space-y-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setAskState({ kind: "busy" });
          try {
            const result = await onAskToAdd(askName);
            setAskState(result.ok ? { kind: "asked", label: result.label } : { kind: "error", text: result.error });
          } catch {
            setAskState({ kind: "error", text: "That didn't go through. Try again in a moment." });
          }
        }}
      >
        <header className="space-y-1">
          <h1 className="font-display text-[30px] font-semibold leading-9 text-kid-green">Ask to add someone</h1>
          <p className="text-base text-ink/70">Only {view.parentLabel} can add people. Tell us who, and we&apos;ll ask.</p>
        </header>
        <label htmlFor="ask-name" className="block space-y-2">
          <span className="text-sm font-semibold text-ink/70">Who do you want to add?</span>
          <input
            id="ask-name"
            value={askName}
            onChange={(e) => setAskName(e.target.value)}
            maxLength={24}
            autoComplete="off"
            placeholder="Grandpa"
            disabled={busy}
            className="h-14 w-full rounded-2xl border border-sand-dark bg-white px-4 text-lg text-ink outline-none focus:ring-4 focus:ring-kid-orange/40"
          />
        </label>
        {askState.kind === "error" && (
          <p role="alert" className="rounded-2xl bg-white px-4 py-3 text-base text-ink ring-1 ring-sand-dark">
            {askState.text}
          </p>
        )}
        <div className="space-y-2">
          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? "Asking…" : `Ask ${view.parentLabel}`}
          </button>
          <button type="button" onClick={() => setScreen({ kind: "send" })} disabled={busy} className="h-12 w-full rounded-2xl text-lg font-semibold text-ink/60 hover:bg-white/60">
            Not now
          </button>
        </div>
      </form>
    );
  }

  if (onNameOwl && !view.kid.owlNamed && !owlSheetDismissed) {
    return (
      <section className="space-y-6 rounded-3xl bg-white px-6 py-8 text-center ring-1 ring-sand-dark">
        <span aria-hidden="true" className="text-6xl leading-none">
          🦉
        </span>
        <div className="space-y-1">
          <h1 className="font-display text-[26px] font-semibold leading-8 text-kid-green">This is your owl</h1>
          <p className="text-base leading-6 text-ink/80">It answers questions about your money. What should we call it?</p>
        </div>
        <NameYourOwl
          onName={async (name) => {
            const result = await onNameOwl(name);
            if (result.ok) {
              setNameRejected(false);
              router.refresh();
            } else {
              setNameRejected(true);
            }
          }}
        />
        {nameRejected && (
          <p role="alert" className="text-sm font-medium text-kid-coral">
            Try another name
          </p>
        )}
        <button type="button" onClick={() => setOwlSheetDismissed(true)} className="text-base font-semibold text-ink/60">
          Maybe later
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[30px] font-semibold leading-9 text-kid-green">Hi {view.kid.name}</h1>
        <Avatar id={view.kid.avatarId} size="standard" className="ring-4 ring-kid-sage/40" />
      </header>

      {approvedSend && approvedContact && (
        <section className="space-y-3 rounded-3xl bg-kid-sage/35 px-5 py-5" aria-labelledby="approved-heading">
          <div className="flex items-center gap-3">
            <KidAvatar avatarId={approvedContact.avatarId} label={approvedContact.label} size="standard" />
            <div>
              <h2 id="approved-heading" className="font-display text-[22px] font-semibold leading-7 text-kid-green">
                {view.parentLabel} said yes
              </h2>
              <p className="text-sm text-ink/70">Your send to {approvedContact.label} is ready to go.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScreen({ kind: "send", start: { contactId: approvedSend.contactId, dollars: approvedSend.dollars, sendNow: true } })}
            className={PRIMARY}
          >
            Tap to send {safeDisplay(approvedSend.dollars)} to {approvedContact.label}
          </button>
        </section>
      )}

      <section className="rounded-3xl bg-kid-sun px-6 py-7 text-center" aria-labelledby="spend-heading">
        <p id="spend-heading" className="text-base font-semibold text-ink/70">
          You have
        </p>
        <p className="font-display text-[56px] font-semibold leading-none tabular-nums text-ink">{view.jars.spend}</p>
        {view.allowance ? (
          <Link
            href="/kid/split"
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full px-3 py-1 text-sm font-medium text-ink/70 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50"
          >
            <span>{view.allowance.whenLabel}</span>
            <span className="rounded-full bg-white/70 px-2 py-0.5 tabular-nums text-ink">{view.allowance.amountDisplay}</span>
          </Link>
        ) : (
          <p className="mt-3 text-sm font-medium text-ink/70">You can send up to {view.dailyLeftDisplay} today</p>
        )}
      </section>

      <button
        type="button"
        onClick={() => {
          setAskNote(false);
          setScreen({ kind: "send" });
        }}
        className="h-16 w-full rounded-2xl bg-kid-orange text-2xl font-bold text-white transition-transform duration-150 ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none"
      >
        Send
      </button>

      {askNote && (
        <p className="rounded-2xl bg-white px-4 py-3 text-base leading-6 text-ink/80 ring-1 ring-sand-dark" role="status">
          {view.parentLabel} adds people from their phone. Ask them to add your friend.
        </p>
      )}

      <section aria-label="Your jars" className="grid grid-cols-2 gap-3">
        <Link
          href="/kid/goal"
          className={`block rounded-2xl px-4 py-4 ring-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 ${JAR_STYLE.save.surface}`}
        >
          <p className={`flex items-center gap-1.5 text-sm font-semibold ${JAR_STYLE.save.text}`}>
            <span aria-hidden="true">{JAR_STYLE.save.emoji}</span> {JAR_STYLE.save.label}
          </p>
          <p className="mt-1 font-display text-[26px] font-semibold leading-8 tabular-nums text-ink">{view.jars.save}</p>
        </Link>
        <Link
          href="/kid/share"
          className={`block rounded-2xl px-4 py-4 ring-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 ${JAR_STYLE.share.surface}`}
        >
          <p className={`flex items-center gap-1.5 text-sm font-semibold ${JAR_STYLE.share.text}`}>
            <span aria-hidden="true">{JAR_STYLE.share.emoji}</span> {JAR_STYLE.share.label}
          </p>
          <p className="mt-1 font-display text-[26px] font-semibold leading-8 tabular-nums text-ink">{view.jars.share}</p>
        </Link>
      </section>

      {approvedShare && approvedShareContact && (
        <section className="space-y-3 rounded-3xl bg-kid-purple/15 px-5 py-5 ring-1 ring-kid-purple/30" aria-labelledby="approved-share-heading">
          <div className="flex items-center gap-3">
            <KidAvatar avatarId={approvedShareContact.avatarId} label={approvedShareContact.label} size="standard" />
            <div>
              <h2 id="approved-share-heading" className="font-display text-[22px] font-semibold leading-7 text-kid-purple">
                {view.parentLabel} said yes, tap to share
              </h2>
              <p className="text-sm text-ink/70">From your share jar to {approvedShareContact.label}.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScreen({ kind: "send", mode: "share", start: { contactId: approvedShare.contactId, dollars: approvedShare.dollars, sendNow: true } })}
            className={PRIMARY}
          >
            Tap to share {safeDisplay(approvedShare.dollars)} with {approvedShareContact.label}
          </button>
        </section>
      )}

      {view.contacts.length > 0 && (
        <section aria-label="Your people" className="space-y-2">
          <h2 className="font-display text-[22px] font-semibold leading-7 text-kid-green">Your people</h2>
          <ul className="flex flex-wrap gap-3">
            {view.contacts.map((contact) => (
              <li key={contact.id} className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 ring-1 ring-sand-dark">
                <KidAvatar avatarId={contact.avatarId} label={contact.label} size="compact" />
                <span className="text-sm font-semibold text-ink">{contact.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.recent.length > 0 && (
        <section aria-label="What happened" className="space-y-2">
          <h2 className="font-display text-[22px] font-semibold leading-7 text-kid-green">What happened</h2>
          <ul className="space-y-2">
            {view.recent.map((event) => (
              <li key={event.id} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-sand-dark">
                <p className="text-base leading-6 text-ink">{event.summary}</p>
                <p className="text-xs font-medium text-ink/50">{event.whenLabel}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label={`Talk to ${view.kid.owlName}`} className="space-y-3 pt-2">
        <OwlButton
          listening={owl.listening}
          speaking={owl.speaking}
          transcript={owl.transcript}
          lastIntent={owl.lastIntent}
          supportsListening={owl.supportsListening}
          onStartListening={owl.startListening}
          onStopListening={owl.stopListening}
          onAsk={(text) => void owl.ask(text)}
        />
        {proposal && proposedContact && (
          <button
            type="button"
            onClick={() => setScreen({ kind: "send", start: { contactId: proposal.contactId, dollars: proposal.dollars } })}
            className={PRIMARY}
          >
            Yes, send {safeDisplay(proposal.dollars)} to {proposedContact.label}
          </button>
        )}
      </section>
    </div>
  );
}
