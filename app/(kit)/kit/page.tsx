"use client";

/**
 * Component kit gallery. Renders every components/ui/* primitive with
 * sample data so the kit can be reviewed in a browser. Not linked from any
 * nav — visit /kit directly.
 */

import { useState } from "react";
import { ArrowLeft, Plus, PiggyBank, Send, Sprout } from "lucide-react";
import { AppShell } from "@/components/ui/AppShell";
import { GuardianNav } from "@/components/family/GuardianNav";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { BalanceCard } from "@/components/ui/BalanceCard";
import { QuickActionRow } from "@/components/ui/QuickAction";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GoalCard } from "@/components/ui/GoalCard";
import { LessonCard } from "@/components/ui/LessonCard";
import { PermissionNotice } from "@/components/ui/PermissionNotice";
import { MoneyState, type MoneyMovingStatus } from "@/components/ui/MoneyState";

const MONEY_STATES: Array<{ status: MoneyMovingStatus; message: string; reference?: string; retryLabel?: string }> = [
  { status: "idle", message: "Add to Japan together whenever you're ready." },
  { status: "pressed", message: "Confirming your tap…" },
  { status: "loading", message: "Adding to Japan together…" },
  { status: "success", message: "$25.00 added to Japan together.", reference: "Ref #A93F · Oct 2" },
  { status: "needs_approval", message: "Maya needs to approve this before it's sent." },
  { status: "scheduled", message: "Scheduled for Oct 1. We'll let you know when it's done." },
  { status: "failed_recoverable", message: "That didn't go through. Your money is safe.", retryLabel: "Try again" },
  {
    status: "blocked_by_rule",
    message: "This is over Eli's daily limit of $10.00. Maya can raise it in Family.",
  },
];

export default function KitGalleryPage() {
  const [revealCount, setRevealCount] = useState(0);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [moneyStateIndex, setMoneyStateIndex] = useState(0);
  const activeMoneyState = MONEY_STATES[moneyStateIndex];

  return (
    <AppShell bottomNav={<GuardianNav />}>
      <div className="space-y-6 pb-4">
        <header className="flex items-center gap-3">
          <ArrowLeft size={20} strokeWidth={2} className="text-forest" aria-hidden="true" />
          <div>
            <h1 className="font-display text-3xl font-semibold text-forest">Edventures Wallet UI kit</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/60">
              <Sprout size={14} strokeWidth={2} aria-hidden="true" />
              Every shared component, with sample data.
            </p>
          </div>
        </header>

        <Section title="AppShell + GuardianNav">
          <p className="text-sm text-ink/70">
            This page itself is wrapped in <code>AppShell</code>, with the guardian footer (<code>GuardianNav</code>:
            Home, Family, Goals and More, which opens the <code>MenuDrawer</code> sheet) fixed below. No tab is
            selected since /kit isn&apos;t one of them.
          </p>
        </Section>

        <Section title="PrimaryButton">
          <div className="space-y-3">
            <PrimaryButton onClick={() => setButtonLoading(true)} loading={buttonLoading} loadingLabel="Adding to Japan together…">
              Add to our goal
            </PrimaryButton>
            <PrimaryButton disabled>Add to our goal</PrimaryButton>
            {buttonLoading && (
              <button
                type="button"
                onClick={() => setButtonLoading(false)}
                className="text-sm font-medium text-forest underline underline-offset-2"
              >
                Reset loading demo
              </button>
            )}
          </div>
        </Section>

        <Section title="BalanceCard">
          <BalanceCard
            label="Family balance"
            value="$8,420.16"
            hint="Everyone's savings and allowances, together."
            onReveal={(revealed) => setRevealCount((count) => count + (revealed ? 0 : 1))}
          />
          <p className="mt-2 text-xs text-ink/50">Hidden {revealCount} time(s) in this session.</p>
        </Section>

        <Section title="QuickAction / QuickActionRow">
          <QuickActionRow
            actions={[
              { icon: Plus, label: "Add money", onClick: () => {} },
              { icon: Send, label: "Send", onClick: () => {} },
              { icon: PiggyBank, label: "Save", onClick: () => {} },
            ]}
          />
        </Section>

        <Section title="ProgressBar">
          <ProgressBar value={61} valueLabel="61%" />
          <ProgressBar className="mt-4" value={140} valueLabel="$3,680 of $6,000 (clamped from 140%)" />
        </Section>

        <Section title="GoalCard">
          <GoalCard
            title="Japan together"
            description="Different contributions. Same direction."
            progress={61}
            progressLabel="61%"
            amountLabel="$3,680 of $6,000"
            participants={[
              { name: "Maya", src: "/illustrations/avatar-maya.png" },
              { name: "Aria", src: "/illustrations/avatar-aria.png" },
              { name: "Eli", src: "/illustrations/avatar-eli.png" },
            ]}
            actionLabel="Add to our goal"
            illustrationSrc="/illustrations/japan-goal-vignette.png"
          />
        </Section>

        <Section title="LessonCard">
          <div className="space-y-4">
            <LessonCard
              title="Before you send"
              durationLabel="5 minutes"
              progress={30}
              progressLabel="1 of 3 steps"
              ctaLabel="Continue lesson"
            />
            <LessonCard
              title="Who can move your money"
              durationLabel="4 minutes"
              progress={100}
              progressLabel="3 of 3 steps"
              completed
              ctaLabel="Review lesson"
            />
          </div>
        </Section>

        <Section title="PermissionNotice">
          <div className="space-y-3">
            <PermissionNotice
              message="Maya approves every change."
              detailsText="Aria can save and contribute within her weekly limit. Maya can change limits, add contacts, or recover the wallet from a new device at any time."
            />
            <PermissionNotice
              tone="green"
              message="This savings plan runs automatically every month."
              detailsText="You can pause or change the amount any time. Nothing is ever guaranteed to grow; this is a plain savings plan, not an investment."
            />
          </div>
        </Section>

        <Section title="MoneyState">
          <div className="space-y-3">
            <MoneyState
              status={activeMoneyState.status}
              message={activeMoneyState.message}
              reference={activeMoneyState.reference}
              retryLabel={activeMoneyState.retryLabel}
              onRetry={() => setMoneyStateIndex(0)}
            />
            <div className="flex flex-wrap gap-2">
              {MONEY_STATES.map((state, index) => (
                <button
                  key={state.status}
                  type="button"
                  onClick={() => setMoneyStateIndex(index)}
                  aria-pressed={index === moneyStateIndex}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    index === moneyStateIndex
                      ? "border-forest bg-forest text-white"
                      : "border-sand-dark bg-white text-ink/70"
                  }`}
                >
                  {state.status}
                </button>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-forest">{title}</h2>
      {children}
    </section>
  );
}
