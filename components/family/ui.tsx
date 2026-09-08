"use client";

import type { ReactNode } from "react";

/** Full width, terracotta, 54px tall. One per screen. */
export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="min-h-[54px] w-full rounded-2xl bg-terracotta px-6 text-lg font-semibold text-white transition-colors hover:bg-terracotta-dark active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** Quieter action: forest outline on the card surface. */
export function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="min-h-[44px] rounded-2xl border border-forest px-5 text-sm font-semibold text-forest transition-colors hover:bg-sand active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** A dollar amount field. The value is a string the server parses; no arithmetic here. */
export function MoneyField({ id, label, hint, value, onChange, disabled }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-semibold text-forest">{label}</span>
      {hint && <span className="block text-xs text-ink/60">{hint}</span>}
      <span className="mt-1 flex min-h-[44px] items-center rounded-xl border border-sand-dark bg-white px-3 focus-within:ring-2 focus-within:ring-terracotta/40">
        <span className="text-ink/60" aria-hidden>
          $
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="w-full bg-transparent py-2 pl-1 text-lg tabular-nums text-ink outline-none"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}

/** PermissionNotice pattern: sand-dark surface, shield, one plain sentence. */
export function RuleNotice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "problem" }) {
  return (
    <div role="status" className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${tone === "problem" ? "bg-white text-terracotta-dark ring-1 ring-terracotta/40" : "bg-sand-dark text-forest"}`}>
      <ShieldCheck />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function SyncChip({ synced }: { synced: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${synced ? "bg-sage/20 text-forest" : "bg-sand-dark text-ink/70"}`}>
      {synced ? "Live on-chain" : "Updating"}
    </span>
  );
}

function ShieldCheck() {
  return (
    <svg className="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
