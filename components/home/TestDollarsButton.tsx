"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fundWallet } from "@/app/wallet/actions";
import { TEST_DOLLARS_LABEL } from "@/lib/money/test-dollars";

/** Devnet only: a small ask for practice money, sitting under the balance. */
export function TestDollarsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const result = await fundWallet();
      if (!result.ok) setError(result.error);
      else router.refresh();
    } catch {
      setError("Something didn't work. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-3 text-xs">
      <button type="button" onClick={add} disabled={busy} className="rounded-full bg-white/15 px-3 py-1.5 font-medium text-white hover:bg-white/25 disabled:opacity-60">
        {busy ? "Adding…" : `Add ${TEST_DOLLARS_LABEL} of test dollars`}
      </button>
      {error && <p className="mt-2 text-sand/90">{error}</p>}
    </div>
  );
}
