"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { kidToastFor, shouldRefresh, toKidChange, type KidChange } from "@/lib/kid/live";
import { createClient } from "@/lib/supabase/client";

const TOAST_MS = 4000;

/**
 * The kid's screen reacting without a reload: a guardian's yes lands as a
 * toast and a fresh render, so do an allowance or money arriving. Realtime
 * on `requests` and `events`, scoped to this kid (RLS scopes the stream to
 * the family; the filter narrows it to the kid). Mounted by KidShell only
 * for a paired kid device.
 */
export function KidLive({ kidId, parentLabel }: { kidId: string; parentLabel: string }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const label = useRef(parentLabel);

  useEffect(() => {
    label.current = parentLabel;
  }, [parentLabel]);

  // A topic per mounted instance: `channel()` reuses a topic's channel, and a subscribed one refuses new callbacks.
  const instance = useId();
  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return; // No Supabase in this build: the page still works, it just does not react live.
    }
    const handle = (change: KidChange | null) => {
      if (!change) return;
      const text = kidToastFor(change, { parentLabel: label.current });
      if (text) setToast({ id: Date.now(), text });
      if (shouldRefresh(change)) router.refresh();
    };
    const channel = supabase
      .channel(`kid:${kidId}:${instance}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "requests", filter: `kid_id=eq.${kidId}` }, (payload) => handle(toKidChange("requests", payload)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter: `kid_id=eq.${kidId}` }, (payload) => handle(toKidChange("events", payload)))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [kidId, instance, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return createPortal(<KidToast key={toast.id} text={toast.text} />, document.body);
}

/** Kid palette, top of the screen, lifts in like a leaf; still under reduced motion. */
function KidToast({ text }: { text: string }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-5" style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}>
      <p className="max-w-md animate-leaf-lift rounded-2xl bg-kid-sun px-5 py-3 text-base font-semibold text-ink shadow-lg ring-1 ring-kid-orange/40 motion-reduce:animate-none">
        <span aria-hidden="true">🦉 </span>
        {text}
      </p>
    </div>
  );
}
