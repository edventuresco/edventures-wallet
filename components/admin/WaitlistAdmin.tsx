"use client";

import { useState } from "react";
import { getWaitlist, setWaitlistStatus, type WaitlistRow } from "@/app/admin/actions";
import { RuleNotice } from "@/components/family/ui";
import { STATUS_LABEL, WAITLIST_STATUSES, type WaitlistStatus } from "@/lib/waitlist/access";
import { countryName } from "@/lib/waitlist/countries";

const chip: Record<WaitlistStatus, string> = {
  waiting: "bg-sand-dark text-forest",
  accepted: "bg-forest text-white",
  declined: "bg-ink/10 text-ink/70",
};

const ACTION_LABEL: Record<WaitlistStatus, string> = { waiting: "Back to waiting", accepted: "Accept", declined: "Decline" };

/** The waitlist: who asked, when, and whether they may sign in. Accepting an email lets it create an account at /login. */
export function WaitlistAdmin({ initial }: { initial: WaitlistRow[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<WaitlistStatus | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = WAITLIST_STATUSES.map((s) => ({ status: s, count: rows.filter((r) => r.status === s).length }));
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  async function change(row: WaitlistRow, status: WaitlistStatus) {
    setBusy(row.id);
    setError(null);
    try {
      const result = await setWaitlistStatus(row.id, status);
      if (!result.ok) setError(result.error);
      else setRows(await getWaitlist());
    } catch {
      setError("That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-3xl text-forest">Waitlist</h1>
        <p className="text-sm text-ink/70">Accepting an email lets that family sign in and set up. Nothing is emailed from here yet.</p>
      </header>

      <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-2">
        <FilterTab selected={filter === "all"} onClick={() => setFilter("all")}>
          All ({rows.length})
        </FilterTab>
        {counts.map(({ status, count }) => (
          <FilterTab key={status} selected={filter === status} onClick={() => setFilter(status)}>
            {STATUS_LABEL[status]} ({count})
          </FilterTab>
        ))}
      </div>

      {error && <RuleNotice tone="problem">{error}</RuleNotice>}

      {shown.length === 0 ? (
        <p className="rounded-[22px] border border-sand-dark bg-white p-5 text-sm text-ink/70">Nobody here yet.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((row) => (
            <li key={row.id} className="space-y-2 rounded-[22px] border border-sand-dark bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{row.email}</p>
                  <p className="text-xs text-ink/60">
                    Joined {formatDay(row.createdAt)}
                    {row.country ? ` · ${countryName(row.country)}` : ""}
                    {row.kids ? ` · ${row.kids} ${row.kids === 1 ? "kid" : "kids"}` : ""}
                    {row.statusChangedAt ? ` · ${STATUS_LABEL[row.status]} ${formatDay(row.statusChangedAt)}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${chip[row.status]}`}>{STATUS_LABEL[row.status]}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {WAITLIST_STATUSES.filter((s) => s !== row.status).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => change(row, s)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${s === "accepted" ? "bg-terracotta text-white" : "border border-sand-dark text-forest"}`}
                  >
                    {busy === row.id ? "Saving…" : ACTION_LABEL[s]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterTab({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={selected} onClick={onClick} className={`rounded-xl px-3 py-2 text-sm font-semibold ${selected ? "bg-forest text-white" : "border border-sand-dark text-forest"}`}>
      {children}
    </button>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
