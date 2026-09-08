"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestSignInCode } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/waitlist/validate";

type Problem = { message: string; waitlist?: boolean };

export function EmailOtpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Problem | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // The server decides whether this email may make an account: accepted on the waitlist, an admin, or already one of ours.
    const result = await requestSignInCode(email);
    setBusy(false);
    if (!result.ok) {
      if (result.reason === "not_invited") return setError({ message: "This email isn't in the beta yet. Join the waitlist and we'll email you when it's your family's turn.", waitlist: true });
      if (result.reason === "invalid_email") return setError({ message: "Check that email address." });
      return setError({ message: "We couldn't send a code to that email. Check it and try again in a minute." });
    }
    setStage("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: normalizeEmail(email) ?? email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setError({ message: "That code didn't work. Check the email and try again." });
    // The server decides where this account lives: home, onboarding, a kid home, or an invite waiting on /join.
    router.push("/login");
    router.refresh();
  }

  const input =
    "w-full rounded-2xl border border-sand-dark bg-white px-4 py-4 text-lg text-ink outline-none focus:ring-4 focus:ring-terracotta/35";
  const button = "w-full rounded-2xl bg-terracotta px-6 py-4 text-lg font-semibold text-white disabled:opacity-60";
  const problem = error && (
    <p className="text-sm text-terracotta-dark">
      {error.message}
      {error.waitlist && (
        <>
          {" "}
          <Link href="/#waitlist" className="font-semibold underline">
            Join the waitlist
          </Link>
        </>
      )}
    </p>
  );

  return stage === "email" ? (
    <form onSubmit={sendCode} className="space-y-4">
      <label className="block text-sm font-semibold text-forest" htmlFor="email">
        Your email
      </label>
      <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      {problem}
      <button type="submit" disabled={busy} className={button}>
        {busy ? "Sending your code…" : "Send me a code"}
      </button>
    </form>
  ) : (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-ink/80">
        We emailed a code to <span className="font-semibold">{email}</span>. Type it in below.
      </p>
      <label className="block text-sm font-semibold text-forest" htmlFor="code">
        Code
      </label>
      <input
        id="code"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className={`${input} text-center tracking-[0.3em]`}
      />
      {problem}
      <button type="submit" disabled={busy} className={button}>
        {busy ? "Checking…" : "Sign in"}
      </button>
      <button type="button" onClick={() => setStage("email")} className="w-full py-2 text-sm text-forest underline">
        Use a different email
      </button>
    </form>
  );
}
