"use client";

import { KidAvatar } from "./KidAvatar";

export type ConfirmState = "idle" | "sending" | "done" | "blocked";

/**
 * Step three of Send: the whole decision in one sentence. One primary
 * button, one quiet way out. Blocked is a warm explanation plus a next
 * step, never a red wall.
 */
export function ConfirmCard({
  amountDisplay,
  contactLabel,
  avatarId,
  state,
  blockedMessage,
  blockedAction,
  onSend,
  onCancel,
  onHome,
  verb = "send",
}: {
  /** "send" (spend money to a person) or "share" (from the share jar). */
  verb?: "send" | "share";
  amountDisplay: string;
  contactLabel: string;
  avatarId: string;
  state: ConfirmState;
  /** Shown when state is "blocked". Specific, kid-language, no jargon. */
  blockedMessage?: string;
  /** Optional next step for the blocked state, e.g. "Pick a smaller amount". */
  blockedAction?: { label: string; onPress: () => void };
  onSend: () => void;
  onCancel: () => void;
  onHome?: () => void;
}) {
  const primary =
    "h-14 w-full rounded-2xl bg-kid-orange text-xl font-bold text-white transition-transform duration-150 ease-out active:translate-y-px disabled:cursor-default disabled:opacity-70 disabled:active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none";
  const quiet =
    "h-12 w-full rounded-2xl text-lg font-semibold text-ink/60 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50";

  if (state === "blocked") {
    return (
      <section className="space-y-6" aria-live="polite">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-8 text-center ring-1 ring-sand-dark">
          <span aria-hidden="true" className="text-5xl leading-none">
            🦉
          </span>
          <h1 className="font-display text-[26px] font-semibold leading-8 text-kid-green">Not this time</h1>
          <p className="max-w-xs text-lg leading-7 text-ink">{blockedMessage}</p>
        </div>
        <div className="space-y-2">
          {blockedAction && (
            <button type="button" onClick={blockedAction.onPress} className={primary}>
              {blockedAction.label}
            </button>
          )}
          {onHome && (
            <button type="button" onClick={onHome} className={blockedAction ? quiet : primary}>
              Back home
            </button>
          )}
        </div>
      </section>
    );
  }

  const sending = state === "sending";
  const done = state === "done";
  const words = verb === "share"
    ? { question: `Share ${amountDisplay} with ${contactLabel}?`, busy: `Sharing ${amountDisplay} with ${contactLabel}…`, button: "Share", busyButton: "Sharing…", doneButton: "Shared" }
    : { question: `Send ${amountDisplay} to ${contactLabel}?`, busy: `Sending ${amountDisplay} to ${contactLabel}…`, button: "Send", busyButton: "Sending…", doneButton: "Sent" };

  return (
    <section className="space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-8 text-center ring-1 ring-sand-dark">
        <KidAvatar avatarId={avatarId} label={contactLabel} size="hero" />
        <h1 className="font-display text-[30px] font-semibold leading-9 text-ink tabular-nums" aria-live="polite">
          {done ? (verb === "share" ? "Shared." : "Sent.") : sending ? words.busy : words.question}
        </h1>
        {!sending && !done && <p className="text-base text-ink/60">Once it goes, it&apos;s theirs to keep.</p>}
      </div>

      <div className="space-y-2">
        <button type="button" onClick={onSend} disabled={sending || done} className={primary}>
          {sending ? words.busyButton : done ? words.doneButton : words.button}
        </button>
        {!done && (
          <button type="button" onClick={onCancel} disabled={sending} className={quiet}>
            Not now
          </button>
        )}
      </div>
    </section>
  );
}
