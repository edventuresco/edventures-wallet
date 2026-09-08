import { describe, expect, it } from "vitest";
import { dollarsToUnits } from "@/lib/money/usdc";
import {
  dailyLeftUnits,
  decideSend,
  leftUnits,
  sentThisWeekUnits,
  sentTodayUnits,
  startOfDay,
  startOfWeek,
  sumSentSince,
  type SendDecisionInput,
  type SentEventRow,
} from "@/lib/kid/rules";

const $ = (d: string) => dollarsToUnits(d);
const TZ = "Asia/Kuching"; // UTC+8, no DST
const now = new Date("2026-09-09T06:30:00Z"); // Wednesday 14:30 in Kuching

const sister = { id: "c_sis", label: "Sister", status: "active" as const };

function input(overrides: Partial<SendDecisionInput> = {}): SendDecisionInput {
  return {
    units: $("2.50"),
    contact: sister,
    dailyLimitUnits: $("50"),
    sentTodayUnits: 0n,
    weeklyLimitUnits: $("100"),
    sentThisWeekUnits: 0n,
    contactWeeklyUnits: $("50"),
    contactSentThisWeekUnits: 0n,
    approvalThresholdUnits: $("20"),
    approvedRequest: null,
    now,
    timeZone: TZ,
    ...overrides,
  };
}

/** Decide, and insist the answer was a stop. */
function stopped(overrides: Partial<SendDecisionInput> = {}) {
  const d = decideSend(input(overrides));
  if (d.kind !== "blocked") throw new Error(`expected blocked, got ${d.kind}`);
  return d;
}

describe("decideSend", () => {
  it("a small send to someone on the list is ok", () => {
    expect(decideSend(input())).toEqual({ kind: "ok" });
  });

  it("zero or negative is stopped before any rule runs", () => {
    expect(decideSend(input({ units: 0n }))).toEqual({ kind: "blocked", reason: "bad_amount", message: "Pick an amount above zero." });
    expect(decideSend(input({ units: -1n, contact: null })).kind).toBe("blocked");
  });

  describe("the list comes first", () => {
    it("nobody by that id", () => {
      expect(decideSend(input({ contact: null }))).toEqual({
        kind: "blocked",
        reason: "not_on_list",
        message: "That person isn't on your list yet. Ask a parent to add them.",
      });
    });

    it("a removed person reads as not on the list", () => {
      expect(stopped({ contact: { ...sister, status: "removed" } }).reason).toBe("not_on_list");
    });

    it("a requested person names them and says a parent still needs to say yes", () => {
      expect(decideSend(input({ contact: { ...sister, status: "requested" } }))).toEqual({
        kind: "blocked",
        reason: "not_on_list",
        message: "Sister isn't on your list yet. A parent still needs to say yes.",
      });
    });

    it("beats every other rule, even when the amount would also break a limit", () => {
      expect(stopped({ contact: null, units: $("999"), sentTodayUnits: $("50") }).reason).toBe("not_on_list");
    });
  });

  describe("daily limit", () => {
    it("says how much is left today", () => {
      expect(decideSend(input({ units: $("15"), dailyLimitUnits: $("50"), sentTodayUnits: $("38") }))).toEqual({
        kind: "blocked",
        reason: "over_daily_limit",
        message: "That's more than you can send today. You have $12.00 left.",
      });
    });

    it("exactly what is left is fine", () => {
      expect(decideSend(input({ units: $("12"), dailyLimitUnits: $("50"), sentTodayUnits: $("38") }))).toEqual({ kind: "ok" });
    });

    it("nothing left today points at tomorrow", () => {
      expect(stopped({ units: $("1"), sentTodayUnits: $("50") }).message).toBe("You've sent all you can today. Tomorrow is a new day.");
      expect(stopped({ units: $("1"), sentTodayUnits: $("60") }).message).toBe("You've sent all you can today. Tomorrow is a new day.");
    });

    it("comes before the weekly limit", () => {
      expect(stopped({ units: $("10"), sentTodayUnits: $("45"), sentThisWeekUnits: $("95") }).reason).toBe("over_daily_limit");
    });
  });

  describe("weekly limit", () => {
    it("says how much is left until Monday", () => {
      expect(decideSend(input({ units: $("10"), weeklyLimitUnits: $("100"), sentThisWeekUnits: $("95") }))).toEqual({
        kind: "blocked",
        reason: "over_weekly_limit",
        message: "That's more than you can send this week. You have $5.00 left until Monday.",
      });
    });

    it("nothing left this week points at Monday", () => {
      expect(stopped({ units: $("1"), sentThisWeekUnits: $("100") }).message).toBe("You've sent all you can this week. Monday is a fresh start.");
    });

    it("comes before the per-person limit", () => {
      expect(stopped({ units: $("10"), sentThisWeekUnits: $("95"), contactSentThisWeekUnits: $("45") }).reason).toBe("over_weekly_limit");
    });
  });

  describe("per-person weekly limit", () => {
    it("names the person and what is left for them", () => {
      expect(decideSend(input({ units: $("5"), contactWeeklyUnits: $("10"), contactSentThisWeekUnits: $("7") }))).toEqual({
        kind: "blocked",
        reason: "over_person_limit",
        message: "That's more than you can send Sister this week. You have $3.00 left for them.",
      });
    });

    it("nothing left for them this week", () => {
      expect(stopped({ units: $("1"), contactWeeklyUnits: $("10"), contactSentThisWeekUnits: $("10") }).message).toBe("You've sent Sister all you can this week. More on Monday.");
    });

    it("comes before the approval threshold", () => {
      expect(stopped({ units: $("25"), contactWeeklyUnits: $("20") }).reason).toBe("over_person_limit");
    });
  });

  describe("approval threshold", () => {
    it("exactly the threshold does not need approval", () => {
      expect(decideSend(input({ units: $("20") }))).toEqual({ kind: "ok" });
    });

    it("above the threshold needs a parent", () => {
      expect(decideSend(input({ units: $("22") }))).toEqual({ kind: "needs_approval" });
    });

    it("a parent's yes today for the same person and amount makes it ok", () => {
      const approvedRequest = { contactId: "c_sis", units: $("22"), decidedAt: new Date("2026-09-08T23:00:00Z") }; // Wednesday 07:00 Kuching
      expect(decideSend(input({ units: $("22"), approvedRequest }))).toEqual({ kind: "ok" });
    });

    it("a yes for a different amount, a different person, or another day does not count", () => {
      const base = { contactId: "c_sis", units: $("22"), decidedAt: now };
      expect(decideSend(input({ units: $("22"), approvedRequest: { ...base, units: $("23") } }))).toEqual({ kind: "needs_approval" });
      expect(decideSend(input({ units: $("22"), approvedRequest: { ...base, contactId: "c_mum" } }))).toEqual({ kind: "needs_approval" });
      // Tuesday 23:30 Kuching: the local day before `now`, though the same UTC date.
      expect(decideSend(input({ units: $("22"), approvedRequest: { ...base, decidedAt: new Date("2026-09-08T15:30:00Z") } }))).toEqual({ kind: "needs_approval" });
    });

    it("a yes does not lift the limits", () => {
      const approvedRequest = { contactId: "c_sis", units: $("60"), decidedAt: now };
      expect(stopped({ units: $("60"), approvedRequest }).reason).toBe("over_daily_limit");
    });
  });
});

describe("leftUnits / dailyLeftUnits", () => {
  it("never goes below zero", () => {
    expect(leftUnits($("50"), $("38"))).toBe($("12"));
    expect(leftUnits($("50"), $("50"))).toBe(0n);
    expect(leftUnits($("50"), $("70"))).toBe(0n);
    expect(dailyLeftUnits($("50"), $("12.34"))).toBe($("37.66"));
  });
});

describe("day and week boundaries in the family timezone", () => {
  it("startOfDay is local midnight", () => {
    expect(startOfDay(now, TZ).toISOString()).toBe("2026-09-08T16:00:00.000Z");
    // 01:00 Monday in Kuching is still Sunday in UTC; the local day wins.
    expect(startOfDay(new Date("2026-09-06T17:00:00Z"), TZ).toISOString()).toBe("2026-09-06T16:00:00.000Z");
  });

  it("startOfWeek is Monday 00:00 local", () => {
    expect(startOfWeek(now, TZ).toISOString()).toBe("2026-09-06T16:00:00.000Z"); // Mon 7 Sep 00:00 Kuching
    expect(startOfWeek(new Date("2026-09-13T10:00:00Z"), TZ).toISOString()).toBe("2026-09-06T16:00:00.000Z"); // Sunday evening: same week
    expect(startOfWeek(new Date("2026-09-13T16:00:00Z"), TZ).toISOString()).toBe("2026-09-13T16:00:00.000Z"); // Monday 00:00: new week
    expect(startOfWeek(new Date("2026-09-06T17:00:00Z"), TZ).toISOString()).toBe("2026-09-06T16:00:00.000Z"); // Monday 01:00, Sunday in UTC
  });

  it("respects other timezones", () => {
    expect(startOfDay(new Date("2026-09-09T02:00:00Z"), "America/New_York").toISOString()).toBe("2026-09-08T04:00:00.000Z");
    expect(startOfWeek(new Date("2026-09-09T02:00:00Z"), "America/New_York").toISOString()).toBe("2026-09-07T04:00:00.000Z");
  });
});

describe("summing sent events", () => {
  const events: SentEventRow[] = [
    { kind: "sent", amount_units: 2_500_000, created_at: "2026-09-09T05:00:00Z", counterparty: "SIS" }, // today
    { kind: "sent", amount_units: "1000000", created_at: "2026-09-09T01:00:00Z", counterparty: "MUM" }, // today, string bigint
    { kind: "sent", amount_units: 10_000_000, created_at: "2026-09-07T20:00:00Z", counterparty: "SIS" }, // Tuesday: this week
    { kind: "sent", amount_units: 40_000_000, created_at: "2026-09-06T10:00:00Z", counterparty: "SIS" }, // Sunday: last week
    { kind: "allowance", amount_units: 9_000_000, created_at: "2026-09-09T01:00:00Z", counterparty: null }, // not a send
    { kind: "blocked", amount_units: 99_000_000, created_at: "2026-09-09T01:00:00Z", counterparty: "SIS" }, // never went
    { kind: "sent", amount_units: null, created_at: "2026-09-09T01:00:00Z", counterparty: "SIS" }, // no amount, ignored
  ];

  it("sums only sent events since the boundary", () => {
    expect(sumSentSince(events, new Date("2026-09-08T16:00:00Z"))).toBe($("3.50"));
    expect(sumSentSince(events, new Date("2026-09-06T16:00:00Z"))).toBe($("13.50"));
    expect(sumSentSince(events, new Date("2026-09-06T16:00:00Z"), "SIS")).toBe($("12.50"));
    expect(sumSentSince([], new Date(0))).toBe(0n);
  });

  it("sentTodayUnits and sentThisWeekUnits use the family timezone", () => {
    expect(sentTodayUnits(events, now, TZ)).toBe($("3.50"));
    expect(sentThisWeekUnits(events, now, TZ)).toBe($("13.50"));
    expect(sentThisWeekUnits(events, now, TZ, "SIS")).toBe($("12.50"));
    expect(sentThisWeekUnits(events, now, TZ, "MUM")).toBe($("1"));
  });
});
