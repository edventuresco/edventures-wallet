"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { acceptInvite } from "@/app/join/actions";
import { getJoinStatus } from "@/app/family/actions";
import { getOrCreateDeviceKey, type DeviceKey } from "@/lib/device/key";
import { createClient } from "@/lib/supabase/client";

type Phase = { step: "starting" } | { step: "no_invite"; message: string } | { step: "waiting"; kidName: string };

const POLL_MS = 3000;

/**
 * The kid's side of joining. A parent invited this email; the kid signed in
 * with it. This device makes its key and joins on its own, then waits for
 * the guardian to approve the device on their phone.
 */
export function JoinScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ step: "starting" });
  const keyRef = useRef<DeviceKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      const key = await getOrCreateDeviceKey();
      keyRef.current = key;
      if (cancelled) return;
      const result = await acceptInvite(key.publicKey);
      if (cancelled) return;
      if (!result.ok) {
        setPhase({ step: "no_invite", message: result.error });
        return;
      }
      if (result.status === "active") {
        router.replace("/kid");
        return;
      }
      setPhase({ step: "waiting", kidName: result.kidName });
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (phase.step !== "waiting") return;
    const id = setInterval(async () => {
      const key = keyRef.current;
      if (!key) return;
      const status = await getJoinStatus(key.publicKey);
      if (status.status === "active") {
        clearInterval(id);
        router.replace("/kid");
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [phase.step, router]);

  if (phase.step === "starting") return <p className="text-center text-xl text-ink/70">Getting ready…</p>;

  return (
    <section className="space-y-4 rounded-3xl bg-white p-6 text-center ring-1 ring-sand-dark" aria-live="polite">
      <span aria-hidden className="text-5xl">
        🦉
      </span>
      {phase.step === "waiting" ? (
        <>
          <h1 className="font-display text-3xl text-kid-green">Hi {phase.kidName}!</h1>
          <p className="text-lg text-ink">You&apos;re in the family. Your grown-up just has to say yes on their phone. Hang on…</p>
          <p className="text-sm text-ink/60">This screen will change by itself.</p>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl text-kid-green">No invite yet</h1>
          <p className="text-lg text-ink">{phase.message}</p>
          <Link href="/wallet" className="text-sm text-ink/60 underline">
            Not a kid? Go to your wallet
          </Link>
        </>
      )}
    </section>
  );
}
