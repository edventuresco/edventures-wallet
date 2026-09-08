"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { applyRequestChange, isNewPending, requestToast, toRequestChange } from "@/lib/family/requests-badge";
import { createClient } from "@/lib/supabase/client";

const TOAST_MS = 4000;

type Props = {
  familyId: string;
  initialPending: number;
  /** kid id → name, for the toast. */
  kidNames: Record<string, string>;
};

/**
 * Live count of requests waiting for the guardian, fed by Realtime on the
 * requests table (RLS scopes the stream to this family). The server renders
 * the first number; every insert or decision after that moves it without a
 * refresh, and a brand-new request gets a four-second toast.
 *
 * The channel topic carries this instance's id: the browser client is a
 * singleton and `channel()` returns an existing channel for a topic, so a
 * second badge on the page (the desktop text nav and the bottom tab both
 * show one) must not attach to a channel that is already subscribed.
 */
export function RequestsBadge({ familyId, initialPending, kidNames }: Props) {
  const [base, setBase] = useState(initialPending);
  const [count, setCount] = useState(initialPending);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const names = useRef(kidNames);
  const instance = useId();

  // A fresh server render is the truth; Realtime moves the number between renders.
  if (base !== initialPending) {
    setBase(initialPending);
    setCount(initialPending);
  }

  useEffect(() => {
    names.current = kidNames;
  }, [kidNames]);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return; // No Supabase in this build: the server-rendered count stands.
    }
    const channel = supabase
      .channel(`requests:${familyId}:${instance}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "requests", filter: `family_id=eq.${familyId}` }, (payload) => {
        const change = toRequestChange(payload);
        if (!change) return;
        setCount((c) => applyRequestChange(c, change));
        if (isNewPending(change) && change.new) setToast({ id: Date.now(), text: requestToast(change.new, names.current) });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [familyId, instance]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <>
      {count > 0 && (
        <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-terracotta px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
          {count}
          <span className="sr-only"> waiting</span>
        </span>
      )}
      {toast && createPortal(<Toast key={toast.id} text={toast.text} />, document.body)}
    </>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-5">
      <p className="max-w-md rounded-2xl bg-forest px-4 py-3 text-sm text-sand shadow-lg ring-1 ring-forest-light">{text}</p>
    </div>
  );
}
