import { describe, expect, it } from "vitest";
import { checkShareBalance, checkShareContact, findApprovedShare, shareRequestSentence, shareSummary, validateShareAmount } from "@/lib/family/share";
import { dollarsToUnits } from "@/lib/money/usdc";

const TZ = "Asia/Kuching";
const NOW = new Date("2026-09-10T06:00:00Z"); // Thursday 14:00 local

describe("validateShareAmount", () => {
  it("accepts a positive dollar amount with up to two decimals", () => {
    expect(validateShareAmount("2.50")).toEqual({ ok: true, units: dollarsToUnits("2.50") });
  });
  it("refuses zero, negatives, and non-amounts", () => {
    expect(validateShareAmount("0").ok).toBe(false);
    expect(validateShareAmount("-1").ok).toBe(false);
    expect(validateShareAmount("1.234").ok).toBe(false);
    expect(validateShareAmount("abc").ok).toBe(false);
  });
});

describe("checkShareContact", () => {
  it("only an active person on the list can receive a share", () => {
    expect(checkShareContact({ id: "c1", label: "Grandma", status: "active" })).toEqual({ ok: true });
    expect(checkShareContact(null)).toEqual({ ok: false, message: "That person isn't on your list yet. Ask a parent to add them." });
    expect(checkShareContact({ id: "c1", label: "Grandma", status: "requested" })).toEqual({ ok: false, message: "Grandma isn't on your list yet. A parent still needs to say yes." });
    expect(checkShareContact({ id: "c1", label: "Grandma", status: "removed" }).ok).toBe(false);
  });
});

describe("checkShareBalance", () => {
  it("says what the share jar holds when the amount is too big", () => {
    expect(checkShareBalance(dollarsToUnits("2"), dollarsToUnits("2"))).toEqual({ ok: true });
    expect(checkShareBalance(dollarsToUnits("5"), dollarsToUnits("1.25"))).toEqual({ ok: false, message: "Your share jar has $1.25 right now. Try a smaller amount." });
    expect(checkShareBalance(dollarsToUnits("5"), 0n)).toEqual({ ok: false, message: "Your share jar is empty right now. Your next allowance adds to it." });
  });
});

describe("findApprovedShare", () => {
  const rows = [
    { id: "r_old", status: "approved", payload: { contactId: "c1", dollars: "2.00", label: "Grandma" }, decided_at: "2026-09-09T10:00:00Z" },
    { id: "r_today", status: "approved", payload: { contactId: "c1", dollars: "2.00", label: "Grandma" }, decided_at: "2026-09-10T02:00:00Z" },
    { id: "r_other", status: "approved", payload: { contactId: "c2", dollars: "2.00", label: "Sam" }, decided_at: "2026-09-10T03:00:00Z" },
    { id: "r_used", status: "used", payload: { contactId: "c1", dollars: "3.00", label: "Grandma" }, decided_at: "2026-09-10T04:00:00Z" },
  ];

  it("finds today's approved request for the same person and amount", () => {
    expect(findApprovedShare(rows, { contactId: "c1", units: dollarsToUnits("2"), now: NOW, timeZone: TZ })?.id).toBe("r_today");
  });

  it("ignores yesterday's yes, other people, other amounts and used requests", () => {
    expect(findApprovedShare(rows, { contactId: "c1", units: dollarsToUnits("3"), now: NOW, timeZone: TZ })).toBeNull();
    expect(findApprovedShare(rows, { contactId: "c9", units: dollarsToUnits("2"), now: NOW, timeZone: TZ })).toBeNull();
    expect(findApprovedShare([rows[0]], { contactId: "c1", units: dollarsToUnits("2"), now: NOW, timeZone: TZ })).toBeNull();
  });

  it("picks the newest approved share for today when no target is given", () => {
    expect(findApprovedShare(rows, { now: NOW, timeZone: TZ })?.id).toBe("r_other");
  });
});

describe("copy", () => {
  it("writes the event and the guardian's sentence", () => {
    expect(shareSummary(dollarsToUnits("2"), "Grandma")).toBe("Shared $2.00 with Grandma");
    expect(shareRequestSentence("Mia", "$2.00", "Grandma")).toBe("Mia wants to share $2.00 with Grandma from their share jar");
  });
});
