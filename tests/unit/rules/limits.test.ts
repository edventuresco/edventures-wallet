import { describe, expect, it } from "vitest";
import { dollarsToUnits } from "@/lib/money/usdc";
import {
  RAISE_DELAY_MS,
  appliesAtLabel,
  applyLimitChange,
  defaultLimits,
  limitRowFromDb,
  limitRowToDb,
  resolvePending,
  type LimitRow,
} from "@/lib/rules/limits";

const $ = (d: string) => dollarsToUnits(d);
const now = new Date("2026-09-07T06:30:00Z"); // 14:30 in Asia/Kuching

function kidRow(overrides: Partial<LimitRow> = {}): LimitRow {
  return { ...defaultLimits("kid"), ...overrides };
}

describe("defaultLimits", () => {
  it("kid: $50 a day, $100 a week, $20 approval threshold", () => {
    expect(defaultLimits("kid")).toEqual({
      daily_limit_units: $("50"),
      weekly_limit_units: $("100"),
      approval_threshold_units: $("20"),
      pending_raise: null,
    });
  });

  it("guardian: $1,000 a day", () => {
    expect(defaultLimits("guardian").daily_limit_units).toBe($("1000"));
    expect(defaultLimits("guardian").approval_threshold_units).toBe($("20"));
  });
});

describe("applyLimitChange", () => {
  it("lowering applies at once", () => {
    const next = applyLimitChange(kidRow(), "daily_limit_units", $("30"), now);
    expect(next.daily_limit_units).toBe($("30"));
    expect(next.pending_raise).toBeNull();
  });

  it("raising is stored as a pending raise four hours out; the live value does not move", () => {
    const next = applyLimitChange(kidRow(), "daily_limit_units", $("80"), now);
    expect(next.daily_limit_units).toBe($("50"));
    expect(next.pending_raise).toEqual({
      field: "daily_limit_units",
      units: $("80"),
      effective_at: new Date(now.getTime() + RAISE_DELAY_MS),
    });
    expect(RAISE_DELAY_MS).toBe(4 * 60 * 60 * 1000);
  });

  it("setting the current value is a no-op", () => {
    const row = kidRow();
    expect(applyLimitChange(row, "weekly_limit_units", $("100"), now)).toEqual(row);
  });

  it("setting the current value cancels a pending raise on that field", () => {
    const row = kidRow({ pending_raise: { field: "daily_limit_units", units: $("80"), effective_at: new Date(now.getTime() + 1000) } });
    const next = applyLimitChange(row, "daily_limit_units", $("50"), now);
    expect(next.daily_limit_units).toBe($("50"));
    expect(next.pending_raise).toBeNull();
  });

  it("lowering clears a pending raise on the same field", () => {
    const row = kidRow({ pending_raise: { field: "daily_limit_units", units: $("80"), effective_at: new Date(now.getTime() + 1000) } });
    const next = applyLimitChange(row, "daily_limit_units", $("20"), now);
    expect(next.daily_limit_units).toBe($("20"));
    expect(next.pending_raise).toBeNull();
  });

  it("lowering one field leaves a pending raise on another field alone", () => {
    const pending = { field: "weekly_limit_units" as const, units: $("200"), effective_at: new Date(now.getTime() + 1000) };
    const next = applyLimitChange(kidRow({ pending_raise: pending }), "daily_limit_units", $("20"), now);
    expect(next.pending_raise).toEqual(pending);
  });

  it("applies to the approval threshold too (a higher threshold is a looser rule)", () => {
    const next = applyLimitChange(kidRow(), "approval_threshold_units", $("40"), now);
    expect(next.approval_threshold_units).toBe($("20"));
    expect(next.pending_raise?.field).toBe("approval_threshold_units");
  });

  it("rejects negative amounts", () => {
    expect(() => applyLimitChange(kidRow(), "daily_limit_units", -1n, now)).toThrow();
  });
});

describe("resolvePending", () => {
  it("applies a pending raise whose time has passed", () => {
    const row = kidRow({ pending_raise: { field: "daily_limit_units", units: $("80"), effective_at: new Date(now.getTime() - 1) } });
    const { row: resolved, changed } = resolvePending(row, now);
    expect(changed).toBe(true);
    expect(resolved.daily_limit_units).toBe($("80"));
    expect(resolved.pending_raise).toBeNull();
  });

  it("leaves a raise that is still in the future", () => {
    const row = kidRow({ pending_raise: { field: "daily_limit_units", units: $("80"), effective_at: new Date(now.getTime() + 1) } });
    const { row: resolved, changed } = resolvePending(row, now);
    expect(changed).toBe(false);
    expect(resolved).toEqual(row);
  });

  it("is a no-op without a pending raise", () => {
    expect(resolvePending(kidRow(), now)).toEqual({ row: kidRow(), changed: false });
  });
});

describe("appliesAtLabel", () => {
  it("shows the effective time in the family timezone", () => {
    const effective = new Date(now.getTime() + RAISE_DELAY_MS); // 18:30 Kuching
    expect(appliesAtLabel(effective, now, "Asia/Kuching")).toBe("Applies at 18:30");
  });

  it("says tomorrow when the raise lands after local midnight", () => {
    const late = new Date("2026-09-07T14:30:00Z"); // 22:30 Kuching
    const effective = new Date(late.getTime() + RAISE_DELAY_MS); // 02:30 next day
    expect(appliesAtLabel(effective, late, "Asia/Kuching")).toBe("Applies tomorrow at 02:30");
  });
});

describe("db mapping", () => {
  it("round-trips bigint columns and the pending_raise json", () => {
    const row = kidRow({ pending_raise: { field: "daily_limit_units", units: $("80"), effective_at: new Date("2026-09-07T10:30:00.000Z") } });
    const db = limitRowToDb(row);
    expect(db).toEqual({
      daily_limit_units: 50_000_000,
      weekly_limit_units: 100_000_000,
      approval_threshold_units: 20_000_000,
      pending_raise: { field: "daily_limit_units", units: 80_000_000, effective_at: "2026-09-07T10:30:00.000Z" },
    });
    expect(limitRowFromDb(db)).toEqual(row);
  });

  it("reads a null pending_raise", () => {
    expect(limitRowFromDb({ daily_limit_units: 1, weekly_limit_units: 2, approval_threshold_units: 3, pending_raise: null })).toEqual({
      daily_limit_units: 1n,
      weekly_limit_units: 2n,
      approval_threshold_units: 3n,
      pending_raise: null,
    });
  });
});
