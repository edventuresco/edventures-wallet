import { describe, expect, it } from "vitest";
import { applyRequestChange, isNewPending, requestToast, toRequestChange, type RequestChange } from "@/lib/family/requests-badge";

const insert = (status = "pending"): RequestChange => ({ eventType: "INSERT", new: { id: "r1", status }, old: null });
const update = (from: string | undefined, to: string): RequestChange => ({ eventType: "UPDATE", new: { id: "r1", status: to }, old: from === undefined ? { id: "r1" } : { id: "r1", status: from } });
const remove = (status?: string): RequestChange => ({ eventType: "DELETE", new: null, old: status ? { id: "r1", status } : { id: "r1" } });

describe("applyRequestChange", () => {
  it("counts a new pending request and ignores one that arrives already decided", () => {
    expect(applyRequestChange(0, insert())).toBe(1);
    expect(applyRequestChange(2, insert("approved"))).toBe(2);
  });

  it("takes one off when a pending request is decided", () => {
    expect(applyRequestChange(3, update("pending", "approved"))).toBe(2);
    expect(applyRequestChange(3, update("pending", "declined"))).toBe(2);
  });

  it("leaves the count alone when an approved request is used, given the old row", () => {
    expect(applyRequestChange(1, update("approved", "used"))).toBe(1);
  });

  it("reads any move off pending as a decision when the old row is unknown", () => {
    expect(applyRequestChange(2, update(undefined, "declined"))).toBe(1);
    expect(applyRequestChange(2, update(undefined, "pending"))).toBe(2);
  });

  it("adds one back if a decided request is reopened", () => {
    expect(applyRequestChange(0, update("declined", "pending"))).toBe(1);
  });

  it("takes one off when a pending request is deleted, and only then", () => {
    expect(applyRequestChange(1, remove("pending"))).toBe(0);
    expect(applyRequestChange(1, remove("approved"))).toBe(1);
    expect(applyRequestChange(1, remove())).toBe(1);
  });

  it("never goes below zero", () => {
    expect(applyRequestChange(0, update("pending", "approved"))).toBe(0);
    expect(applyRequestChange(0, remove("pending"))).toBe(0);
  });

  it("folds a sequence of changes", () => {
    const changes = [insert(), insert(), update("pending", "approved"), insert("declined"), update("approved", "used")];
    expect(changes.reduce(applyRequestChange, 0)).toBe(1);
  });
});

describe("toRequestChange", () => {
  it("shapes a Realtime insert, whose old row is an empty object, into a change", () => {
    expect(toRequestChange({ eventType: "INSERT", new: { id: "r1", status: "pending" }, old: {} })).toEqual({ eventType: "INSERT", new: { id: "r1", status: "pending" }, old: null });
  });

  it("keeps the old row on an update and drops the new one on a delete", () => {
    expect(toRequestChange({ eventType: "UPDATE", new: { status: "approved" }, old: { status: "pending" } })).toEqual({ eventType: "UPDATE", new: { status: "approved" }, old: { status: "pending" } });
    expect(toRequestChange({ eventType: "DELETE", new: {}, old: { id: "r1" } })).toEqual({ eventType: "DELETE", new: null, old: { id: "r1" } });
  });

  it("ignores anything that is not a row change", () => {
    expect(toRequestChange({ eventType: "*" })).toBeNull();
  });
});

describe("isNewPending", () => {
  it("is true only for an insert that is still pending", () => {
    expect(isNewPending(insert())).toBe(true);
    expect(isNewPending(insert("approved"))).toBe(false);
    expect(isNewPending(update("declined", "pending"))).toBe(false);
  });
});

describe("requestToast", () => {
  const names = { kid_1: "Mia" };
  const row = (type: string, payload: Record<string, unknown>) => ({ id: "r1", kid_id: "kid_1", type, status: "pending", payload });

  it("says who wants to send how much to whom", () => {
    expect(requestToast(row("approve_send", { contactId: "c1", dollars: "22", label: "Sister" }), names)).toBe("Mia wants to send $22.00 to Sister");
    expect(requestToast(row("approve_send", { contactId: "c1", dollars: 5.5, label: "Sister" }), names)).toBe("Mia wants to send $5.50 to Sister");
  });

  it("falls back when the kid, the amount or the person is missing", () => {
    expect(requestToast({ ...row("approve_send", { dollars: "22", label: "Sister" }), kid_id: "kid_9" }, names)).toBe("Your kid wants to send $22.00 to Sister");
    expect(requestToast(row("approve_send", { label: "Sister" }), names)).toBe("Mia wants to send money to Sister");
    expect(requestToast(row("approve_send", { dollars: "abc", label: "Sister" }), names)).toBe("Mia wants to send money to Sister");
    expect(requestToast(row("approve_send", { dollars: "22" }), names)).toBe("Mia wants to send $22.00");
    expect(requestToast({ id: "r1", kid_id: "kid_1", type: "approve_send", payload: null }, names)).toBe("Mia wants to send money");
  });

  it("reads the other request types in their own words", () => {
    expect(requestToast(row("share", { dollars: "5", label: "Sister" }), names)).toBe("Mia wants to share $5.00 with Sister");
    expect(requestToast(row("add_contact", { label: "Grandma" }), names)).toBe("Mia wants to add Grandma to the list");
    expect(requestToast(row("add_contact", {}), names)).toBe("Mia wants to add someone to the list");
    expect(requestToast(row("something_new", {}), names)).toBe("Mia sent you a request");
  });
});
