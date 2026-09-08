"use client";

import { SendFlow, type SendResult } from "@/components/kid/send/SendFlow";
import { dollarsToUnits } from "@/lib/money/usdc";

const CONTACTS = [
  { id: "c_mum", label: "Mum", avatarId: "parent", weeklyLeftDisplay: "$5.00 left this week" },
  { id: "c_sis", label: "Sister", avatarId: "bunny", weeklyLeftDisplay: "$3.00 left this week" },
  { id: "c_gran", label: "Grandma", avatarId: "person", weeklyLeftDisplay: "$2.00 left this week" },
];

const APPROVAL_FROM = dollarsToUnits("5");
const BLOCKED_ABOVE = dollarsToUnits("10");

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fake send: under $5 goes, $5–$10 asks a parent, above $10 is refused. */
async function fakeSend(contactId: string, dollars: string): Promise<SendResult> {
  await wait(700);
  const units = dollarsToUnits(dollars);
  const contact = CONTACTS.find((c) => c.id === contactId);
  if (units > BLOCKED_ABOVE) {
    return {
      ok: false,
      message: `That's more than your list allows for ${contact?.label ?? "them"} this week. Try a smaller amount, or ask Mum to change it.`,
    };
  }
  if (units >= APPROVAL_FROM) {
    return { ok: false, message: "Needs approval", needsApproval: true };
  }
  return { ok: true, explorerUrl: "https://explorer.solana.com/?cluster=devnet" };
}

/** Kit page: the kid Send flow with fake data, for review in a browser. Not linked from the app. */
export default function SendDemoPage() {
  return (
    <div className="min-h-dvh bg-sand">
      <main className="mx-auto max-w-md px-5 py-8 sm:px-6">
        <SendFlow contacts={CONTACTS} dailyLeftUnits={dollarsToUnits("23")} onSend={fakeSend} onAskToAdd={() => {}} />
      </main>
    </div>
  );
}
