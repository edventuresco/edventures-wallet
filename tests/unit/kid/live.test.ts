import { describe, expect, it } from "vitest";
import { kidToastFor, toKidChange, type KidChange } from "@/lib/kid/live";

const ctx = { parentLabel: "Mum" };

const request = (from: string | undefined, to: string): KidChange => ({
  table: "requests",
  eventType: "UPDATE",
  new: { id: "r1", status: to, type: "approve_send", payload: { dollars: "22", label: "Sam" } },
  old: from === undefined ? { id: "r1" } : { id: "r1", status: from },
});
const event = (kind: string, summary = ""): KidChange => ({ table: "events", eventType: "INSERT", new: { id: "e1", kind, summary }, old: null });

describe("kidToastFor", () => {
  it("cheers when a parent says yes to a send or a share", () => {
    expect(kidToastFor(request("pending", "approved"), ctx)).toBe("Mum said yes! Tap to send $22.00 to Sam.");
    expect(kidToastFor({ ...request("pending", "approved"), new: { id: "r2", status: "approved", type: "share", payload: { dollars: "2", label: "Grandma" } } }, ctx)).toBe(
      "Mum said yes! Tap to share $2.00 with Grandma.",
    );
    expect(kidToastFor({ ...request("pending", "approved"), new: { id: "r3", status: "approved", type: "approve_send", payload: null } }, ctx)).toBe("Mum said yes!");
  });

  it("uses the parent's own label", () => {
    expect(kidToastFor(request("pending", "approved"), { parentLabel: "Guardian" })).toBe("Guardian said yes! Tap to send $22.00 to Sam.");
  });

  it("tells the kid gently when a parent says no, and nothing for other request changes", () => {
    expect(kidToastFor(request("pending", "declined"), ctx)).toBe("Not this time. Mum said no to that one.");
    expect(kidToastFor(request("approved", "used"), ctx)).toBeNull();
    expect(kidToastFor(request("approved", "approved"), ctx)).toBeNull();
    expect(kidToastFor({ ...request("pending", "approved"), eventType: "INSERT", old: null }, ctx)).toBeNull();
  });

  it("announces an allowance landing and money received", () => {
    expect(kidToastFor(event("allowance"), ctx)).toBe("Your allowance just landed!");
    expect(kidToastFor(event("received", "Mum sent you $5.00"), ctx)).toBe("Mum sent you $5.00");
    expect(kidToastFor(event("received"), ctx)).toBe("Money just arrived!");
    expect(kidToastFor(event("contact_added", "Grandpa is on your list now"), ctx)).toBe("Grandpa is on your list now");
  });

  it("stays quiet for the kid's own sends and everything else", () => {
    expect(kidToastFor(event("sent"), ctx)).toBeNull();
    expect(kidToastFor(event("blocked"), ctx)).toBeNull();
    expect(kidToastFor(event("saved"), ctx)).toBeNull();
    expect(kidToastFor({ ...event("allowance"), eventType: "UPDATE" }, ctx)).toBeNull();
  });
});

describe("toKidChange", () => {
  it("shapes a Realtime payload and drops anything that is not a row change", () => {
    expect(toKidChange("events", { eventType: "INSERT", new: { id: "e1", kind: "allowance" }, old: {} })).toEqual({ table: "events", eventType: "INSERT", new: { id: "e1", kind: "allowance" }, old: null });
    expect(toKidChange("requests", { eventType: "TRUNCATE" })).toBeNull();
  });
});
