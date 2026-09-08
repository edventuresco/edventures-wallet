"use client";

import { useEffect, useRef, useState } from "react";
import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";
import { AmountPad } from "./AmountPad";
import { Celebration } from "./Celebration";
import { ConfirmCard } from "./ConfirmCard";
import { ContactGrid, type SendContact } from "./ContactGrid";

export type SendResult =
  | { ok: true; explorerUrl?: string }
  | { ok: false; message: string; needsApproval?: boolean };

type Step =
  | { step: "pick" }
  | { step: "amount"; contact: SendContact; raw: string }
  | { step: "confirm"; contact: SendContact; dollars: string; status: "idle" | "sending" }
  | { step: "waiting"; contact: SendContact; dollars: string }
  | { step: "blocked"; contact: SendContact; dollars: string; message: string }
  | { step: "done"; contact: SendContact; dollars: string; explorerUrl?: string };

/** Strip the dollar sign and separators so the pad can pick up where the kid left off. */
function dollarsToRaw(dollars: string): string {
  return dollars.replace(/[$,]/g, "");
}

/** Where the flow opens when something else already chose the person and amount. */
export type SendStart = {
  contactId: string;
  /** e.g. "2.50" */
  dollars: string;
  /** Send at once, for a request a guardian has already approved. Otherwise open on the confirm card. */
  sendNow?: boolean;
};

function initialStep(contacts: SendContact[], start?: SendStart): Step {
  const contact = start && contacts.find((c) => c.id === start.contactId);
  if (!start || !contact) return { step: "pick" };
  return { step: "confirm", contact, dollars: start.dollars, status: start.sendNow ? "sending" : "idle" };
}

/**
 * The kid Send flow: pick → amount → confirm → celebrate, or a warm stop.
 * Pure UI. Every decision about limits, lists and approvals belongs to
 * `onSend`, which the page wires to a server action.
 */
export function SendFlow({
  contacts,
  dailyLeftUnits,
  onSend,
  onAskToAdd,
  onHome,
  onResult,
  start,
  parentName = "Mum",
  mode = "send",
}: {
  /** "share" swaps the words: Share $2 with Grandma? / Shared. Grandma has your $2. */
  mode?: "send" | "share";
  contacts: SendContact[];
  /** What the kid can still send today, in USDC base units. */
  dailyLeftUnits: bigint;
  onSend: (contactId: string, dollars: string) => Promise<SendResult>;
  onAskToAdd?: () => void;
  onHome?: () => void;
  /** Every outcome of onSend, so the screen around the flow can remember why a send stopped. */
  onResult?: (result: SendResult) => void;
  /** Open on the confirm card (an owl proposal) or send at once (an approved request). */
  start?: SendStart;
  /** How the kid refers to their guardian, for approval copy. */
  parentName?: string;
}) {
  const [state, setState] = useState<Step>(() => initialStep(contacts, start));
  const home = onHome ?? (() => setState({ step: "pick" }));
  const startedRef = useRef(false);

  useEffect(() => {
    if (!start?.sendNow || startedRef.current) return;
    const contact = contacts.find((c) => c.id === start.contactId);
    if (!contact) return;
    startedRef.current = true;
    void send(contact, start.dollars);
    // Runs once on mount for an approved send; `send` is stable enough for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint =
    dailyLeftUnits > 0n
      ? `You can send up to ${unitsToDisplay(dailyLeftUnits)} today`
      : "You've sent all you can today. Tomorrow is a new day.";

  async function send(contact: SendContact, dollars: string) {
    setState({ step: "confirm", contact, dollars, status: "sending" });
    let result: SendResult;
    try {
      result = await onSend(contact.id, dollars);
    } catch {
      result = { ok: false, message: "That didn't go through, and nothing was sent. Try again in a moment." };
    }
    onResult?.(result);
    if (result.ok) {
      setState({ step: "done", contact, dollars, explorerUrl: result.explorerUrl });
    } else if (result.needsApproval) {
      setState({ step: "waiting", contact, dollars });
    } else {
      setState({ step: "blocked", contact, dollars, message: result.message });
    }
  }

  switch (state.step) {
    case "pick":
      return (
        <ContactGrid
          contacts={contacts}
          onAskToAdd={onAskToAdd}
          onPick={(id) => {
            const contact = contacts.find((c) => c.id === id);
            if (contact) setState({ step: "amount", contact, raw: "" });
          }}
        />
      );

    case "amount":
      return (
        <AmountPad
          key={state.contact.id}
          title={`How much for ${state.contact.label}?`}
          hint={hint}
          maxUnits={dailyLeftUnits}
          initial={state.raw}
          onBack={() => setState({ step: "pick" })}
          onConfirm={(dollars) => setState({ step: "confirm", contact: state.contact, dollars, status: "idle" })}
        />
      );

    case "confirm":
      return (
        <ConfirmCard
          amountDisplay={unitsToDisplay(dollarsToUnits(state.dollars))}
          contactLabel={state.contact.label}
          avatarId={state.contact.avatarId}
          state={state.status}
          verb={mode}
          onSend={() => send(state.contact, state.dollars)}
          onCancel={() => (start ? home() : setState({ step: "amount", contact: state.contact, raw: dollarsToRaw(state.dollars) }))}
        />
      );

    case "waiting":
      return (
        <ConfirmCard
          amountDisplay={unitsToDisplay(dollarsToUnits(state.dollars))}
          contactLabel={state.contact.label}
          avatarId={state.contact.avatarId}
          state="blocked"
          blockedMessage={`This one needs a parent. We asked ${parentName}.`}
          onSend={() => {}}
          onCancel={home}
          onHome={home}
        />
      );

    case "blocked":
      return (
        <ConfirmCard
          amountDisplay={unitsToDisplay(dollarsToUnits(state.dollars))}
          contactLabel={state.contact.label}
          avatarId={state.contact.avatarId}
          state="blocked"
          blockedMessage={state.message}
          blockedAction={{
            label: "Try a different amount",
            onPress: () => setState({ step: "amount", contact: state.contact, raw: dollarsToRaw(state.dollars) }),
          }}
          onSend={() => {}}
          onCancel={home}
          onHome={home}
        />
      );

    case "done":
      return (
        <Celebration
          contactLabel={state.contact.label}
          amountDisplay={unitsToDisplay(dollarsToUnits(state.dollars))}
          explorerUrl={state.explorerUrl}
          sentence={mode === "share" ? `Shared. ${state.contact.label} has your ${unitsToDisplay(dollarsToUnits(state.dollars))}.` : undefined}
          onHome={home}
        />
      );
  }
}
