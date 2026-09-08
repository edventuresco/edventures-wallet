"use client";

import { useState } from "react";
import { joinWaitlist } from "@/app/waitlist/actions";
import { COUNTRIES } from "@/lib/waitlist/countries";

const input = "w-full rounded-2xl border border-sand-dark bg-white px-4 py-4 text-lg text-ink outline-none focus:ring-4 focus:ring-terracotta/35";


type Status = { kind: "ok"; already: boolean } | { kind: "error"; message: string } | null;

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [kids, setKids] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const result = await joinWaitlist({
        email,
        country,
        kids: kids ? Number(kids) : undefined,
      });
      if (result.ok) {
        setStatus({ kind: "ok", already: result.already });
        if (!result.already) {
          setEmail("");
          setCountry("");
          setKids("");
        }
      } else {
        setStatus({
          kind: "error",
          message: result.error === "invalid_email" ? "Check that email address." : "Something didn't work. Try again in a moment.",
        });
      }
    } catch {
      setStatus({ kind: "error", message: "Something didn't work. Try again in a moment." });
    } finally {
      setBusy(false);
    }
  }

  if (status?.kind === "ok") {
    return (
      <div className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-sand-dark">
        <h2 className="text-xl text-forest">{status.already ? "You're already on the list" : "You're on the list"}</h2>
        <p className="text-ink/80">We&apos;ll email you when your family&apos;s turn comes.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-sand-dark">
      <h2 className="text-xl text-forest">Join the waitlist</h2>
      <p className="text-ink/80">We&apos;re onboarding the first families now. Tell us where to reach you.</p>
      <input
        type="email"
        aria-label="Email address"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className={input}
      />
      <select
        autoComplete="country"
        aria-label="Country or region"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        required
        className={`${input} ${country ? "" : "text-ink/50"}`}
      >
        <option value="" disabled>
          Country or region
        </option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={6}
        aria-label="How many kids?"
        placeholder="How many kids? (optional)"
        value={kids}
        onChange={(e) => setKids(e.target.value)}
        className={input}
      />
      <button type="submit" disabled={busy} className="w-full rounded-2xl bg-terracotta px-6 py-4 text-lg font-semibold text-white disabled:opacity-60">
        {busy ? "Joining…" : "Join the waitlist"}
      </button>
      {status?.kind === "error" && <p className="text-sm text-terracotta-dark">{status.message}</p>}
    </form>
  );
}
