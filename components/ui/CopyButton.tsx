"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies `text` to the clipboard and says so for two seconds. */
export function CopyButton({ text, label = "Copy address" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // No clipboard here (an old browser, or no permission): the address is still on screen to select.
        }
      }}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-forest px-4 text-sm font-semibold text-forest hover:bg-sand-dark/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-terracotta/40"
      aria-live="polite"
    >
      {copied ? <Check size={18} strokeWidth={2} aria-hidden="true" /> : <Copy size={18} strokeWidth={2} aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
}
