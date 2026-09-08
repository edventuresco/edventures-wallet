"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideRequest } from "@/app/family/requests/actions";
import { shareRequestSentence } from "@/lib/family/share";
import type { RequestsScreenProps, RequestView } from "./contract";
import { PrimaryButton, RuleNotice, SecondaryButton } from "./ui";

const STATUS_LABEL: Record<RequestView["status"], string> = { pending: "Waiting", approved: "Approved", declined: "Declined", used: "Sent" };

/** "Mia wants to send $22.00 to Sam" / "Mia wants to share $2.00 with Grandma from their share jar". */
const money = (r: RequestView) => r.amount?.display ?? "";

function askSentence(r: RequestView): string {
  if (r.type === "add_contact") return `${r.kidName} wants to add ${r.contactLabel} to their list`;
  return r.type === "share" ? shareRequestSentence(r.kidName, money(r), r.contactLabel) : `${r.kidName} wants to send ${money(r)} to ${r.contactLabel}`;
}

function approvedSentence(r: RequestView): string {
  if (r.type === "add_contact") return `Add ${r.contactLabel} with their address on the Rules page, then push the rules on-chain.`;
  return r.type === "share" ? `${r.kidName} can share ${money(r)} with ${r.contactLabel} today.` : `${r.kidName} can send ${money(r)} to ${r.contactLabel} today.`;
}

function decidedSentence(r: RequestView): string {
  const used = r.status === "used";
  if (r.type === "add_contact") return `${r.kidName} asked to add ${r.contactLabel}`;
  return r.type === "share"
    ? `${r.kidName} ${used ? "shared" : "asked to share"} ${money(r)} with ${r.contactLabel}`
    : `${r.kidName} ${used ? "sent" : "asked to send"} ${money(r)} to ${r.contactLabel}`;
}

/** The guardian's inbox: each ask gets one yes or no; today's decisions stay visible underneath. */
export function RequestsScreen({ familyName, pending, decided }: RequestsScreenProps) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "info" | "problem"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function decide(request: RequestView, decision: "approved" | "declined") {
    setMessage(null);
    setBusy(request.id);
    startTransition(async () => {
      const result = await decideRequest(request.id, decision);
      setMessage(
        result.ok
          ? { tone: "info", text: decision === "approved" ? approvedSentence(request) : `${request.kidName}'s ask was declined.` }
          : { tone: "problem", text: result.error },
      );
      setBusy(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-forest">Requests</h1>
        <p className="mt-1 text-ink/70">{familyName}. Sends above a kid&apos;s approval threshold, and every share from a share jar, wait here for you. A yes is good for today.</p>
      </div>

      {message && <RuleNotice tone={message.tone}>{message.text}</RuleNotice>}

      {pending.length === 0 && (
        <section className="rounded-[22px] border border-sand-dark bg-white p-5 shadow-sm">
          <h2 className="text-xl text-forest">Nothing waiting</h2>
          <p className="mt-1 text-sm text-ink/60">When a kid asks to send more than their threshold, to share, or to add someone, it shows up here.</p>
        </section>
      )}

      {pending.map((r) => (
        <section key={r.id} className="space-y-4 rounded-[22px] border border-sand-dark bg-white p-5 shadow-sm" aria-labelledby={`request-${r.id}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {r.kidEmoji}
            </span>
            <div className="flex-1">
              <h2 id={`request-${r.id}`} className="text-xl text-forest">
                {askSentence(r)}
              </h2>
              <p className="text-xs text-ink/60">{r.whenLabel}</p>
            </div>
          </div>
          {r.type === "add_contact" && (
            <p className="text-sm text-ink/70">
              Saying yes here tells {r.kidName}; you still type {r.contactLabel}&apos;s address on the{" "}
              <Link href="/family/rules" className="font-semibold text-forest underline">
                Rules page
              </Link>
              .
            </p>
          )}
          <PrimaryButton onClick={() => decide(r, "approved")} disabled={busy !== null}>
            {busy === r.id ? "Saving…" : r.type === "add_contact" ? "Yes, I'll add them" : "Approve"}
          </PrimaryButton>
          <div className="flex justify-end">
            <SecondaryButton onClick={() => decide(r, "declined")} disabled={busy !== null}>
              Decline
            </SecondaryButton>
          </div>
        </section>
      ))}

      {decided.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base text-forest">Decided today</h2>
          <ul className="divide-y divide-sand-dark rounded-[22px] border border-sand-dark bg-white shadow-sm" role="list">
            {decided.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-2xl" aria-hidden>
                  {r.kidEmoji}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-ink">{decidedSentence(r)}</p>
                  <p className="text-xs text-ink/60">{r.whenLabel}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.status === "declined" ? "bg-sand-dark text-ink/70" : "bg-sage/20 text-forest"}`}>{STATUS_LABEL[r.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
