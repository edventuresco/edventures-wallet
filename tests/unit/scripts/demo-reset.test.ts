import { describe, expect, it } from "vitest";
import { familyMembers, formatPlan, parseDemoResetArgs, planDemoReset, type FamilySnapshot } from "@/lib/demo/reset";

// 13:30 in Kuching on 7 Sept; the sponsor window opened at Kuching midnight.
const NOW = new Date("2026-09-07T05:30:00Z");
const SINCE = "2026-09-06T16:00:00.000Z";

const PARENT = "user-parent";
const KID_A_DEVICE = "user-kid-a";
const KID_B_DEVICE = "user-kid-b";
const STRANGER = "user-stranger";

function snapshot(overrides: Partial<FamilySnapshot> = {}): FamilySnapshot {
  return {
    family: { id: "fam-1", name: "Otter family", timezone: "Asia/Kuching" },
    guardians: [{ user_id: PARENT, label: "Parent", email: "parent@example.com" }],
    kids: [
      { id: "kid-a", name: "Ari" },
      { id: "kid-b", name: "Bo" },
    ],
    devices: [
      { id: "dev-parent", kid_id: null, user_id: PARENT, status: "active", pairing_expires_at: null },
      { id: "dev-a", kid_id: "kid-a", user_id: KID_A_DEVICE, status: "active", pairing_expires_at: null },
    ],
    wallets: [
      { id: "w-family", kid_id: null, kind: "family", wallet_address: "FamilyTreasury1111" },
      { id: "w-a-spend", kid_id: "kid-a", kind: "spend", wallet_address: "AriSpend1111" },
    ],
    limits: [],
    requests: [],
    events: [],
    ...overrides,
  };
}

// Postgres hands timestamps back with a +00:00 offset, not a Z; the planner must not compare strings.
const event = (id: string, user_id: string, kind: string, created_at = "2026-09-07T03:00:00.12345+00:00", sponsor_counted = true) => ({ id, user_id, kind, created_at, sponsor_counted });

const plan = (snap: FamilySnapshot, topup: string | null = null) => planDemoReset(snap, { now: NOW, since: SINCE, topup });

describe("parseDemoResetArgs", () => {
  it("reads every flag, in both spellings", () => {
    expect(parseDemoResetArgs(["--family", "fam-1", "--dry-run", "--topup", "100", "--yes"])).toEqual({ family: "fam-1", dryRun: true, topup: "100", yes: true, help: false });
    expect(parseDemoResetArgs(["--family=parent@example.com", "--topup=25.50"])).toEqual({ family: "parent@example.com", dryRun: false, topup: "25.50", yes: false, help: false });
  });
  it("requires --family unless asking for help", () => {
    expect(() => parseDemoResetArgs([])).toThrow(/--family is required/);
    expect(() => parseDemoResetArgs(["--dry-run"])).toThrow(/--family is required/);
    expect(parseDemoResetArgs(["--help"]).help).toBe(true);
  });
  it("rejects a flag without its value and an unknown flag", () => {
    expect(() => parseDemoResetArgs(["--family"])).toThrow(/--family needs a value/);
    expect(() => parseDemoResetArgs(["--family", "--dry-run"])).toThrow(/--family needs a value/);
    expect(() => parseDemoResetArgs(["--family", "fam-1", "--topup"])).toThrow(/--topup needs a value/);
    expect(() => parseDemoResetArgs(["--family", "fam-1", "--nuke"])).toThrow(/Unknown option --nuke/);
  });
});

describe("familyMembers", () => {
  it("lists guardians and the users behind kid devices, once each", () => {
    const snap = snapshot({
      devices: [
        ...snapshot().devices,
        { id: "dev-a-2", kid_id: "kid-a", user_id: KID_A_DEVICE, status: "revoked", pairing_expires_at: null },
        { id: "dev-b-code", kid_id: "kid-b", user_id: null, status: "pending", pairing_expires_at: "2026-09-07T05:45:00Z" },
      ],
    });
    expect(familyMembers(snap)).toEqual([
      { userId: PARENT, who: "Parent (parent@example.com)" },
      { userId: KID_A_DEVICE, who: "Ari's device" },
    ]);
  });
});

describe("planDemoReset: sponsor counter", () => {
  it("picks exactly the rows countSponsoredToday counts: sent or funded, today, still counted, by a member", () => {
    const snap = snapshot({
      events: [
        event("e-sent", KID_A_DEVICE, "sent"),
        event("e-funded", PARENT, "funded"),
        event("e-blocked", KID_A_DEVICE, "blocked"),
        event("e-allowance", PARENT, "allowance"),
        event("e-yesterday", KID_A_DEVICE, "sent", "2026-09-06T15:59:59+00:00"),
        event("e-already", KID_A_DEVICE, "sent", "2026-09-07T04:00:00+00:00", false),
        event("e-stranger", STRANGER, "sent"),
      ],
    });
    const p = plan(snap);
    expect(p.sponsor.eventIds).toEqual(["e-sent", "e-funded"]);
    expect(p.sponsor.perMember).toEqual([
      { userId: PARENT, who: "Parent (parent@example.com)", count: 1 },
      { userId: KID_A_DEVICE, who: "Ari's device", count: 1 },
    ]);
  });
  it("treats an event at the exact start of the window as today", () => {
    const p = plan(snapshot({ events: [event("e-midnight", PARENT, "sent", "2026-09-06T16:00:00+00:00")] }));
    expect(p.sponsor.eventIds).toEqual(["e-midnight"]);
  });
  it("has nothing to do for a quiet family", () => {
    const p = plan(snapshot());
    expect(p.sponsor).toEqual({ eventIds: [], perMember: [] });
    expect(p.requests).toEqual({ ids: [], perStatus: {} });
    expect(p.pendingRaises).toEqual({ limitIds: [], who: [] });
    expect(p.expiredPairings.deviceIds).toEqual([]);
    expect(p.topup).toBeNull();
    expect(p.since).toBe(SINCE);
  });
});

describe("planDemoReset: requests and pending raises", () => {
  it("deletes every request whatever its status, and says how many of each", () => {
    const snap = snapshot({
      requests: [
        { id: "r1", kid_id: "kid-a", type: "add_contact", status: "pending" },
        { id: "r2", kid_id: "kid-a", type: "approve_send", status: "pending" },
        { id: "r3", kid_id: "kid-b", type: "share", status: "approved" },
        { id: "r4", kid_id: "kid-b", type: "share", status: "used" },
      ],
    });
    expect(plan(snap).requests).toEqual({ ids: ["r1", "r2", "r3", "r4"], perStatus: { pending: 2, approved: 1, used: 1 } });
  });
  it("clears only limits rows that have a raise waiting", () => {
    const snap = snapshot({
      limits: [
        { id: "l-guardian", kid_id: null, pending_raise: { field: "daily_limit_units", units: 2_000_000_000, effective_at: "2026-09-07T09:00:00Z" } },
        { id: "l-a", kid_id: "kid-a", pending_raise: null },
        { id: "l-b", kid_id: "kid-b", pending_raise: { field: "weekly_limit_units", units: 150_000_000, effective_at: "2026-09-07T09:00:00Z" } },
      ],
    });
    expect(plan(snap).pendingRaises).toEqual({ limitIds: ["l-guardian", "l-b"], who: ["the guardian", "Bo"] });
  });
});

describe("planDemoReset: pairing codes", () => {
  it("deletes unclaimed codes that have expired and nothing else", () => {
    const snap = snapshot({
      devices: [
        ...snapshot().devices,
        { id: "dev-expired", kid_id: "kid-b", user_id: null, status: "pending", pairing_expires_at: "2026-09-07T05:29:59Z" },
        { id: "dev-live-code", kid_id: "kid-b", user_id: null, status: "pending", pairing_expires_at: "2026-09-07T05:45:00Z" },
        { id: "dev-joined", kid_id: "kid-b", user_id: KID_B_DEVICE, status: "pending", pairing_expires_at: "2026-09-07T05:00:00Z" },
        { id: "dev-revoked", kid_id: "kid-a", user_id: null, status: "revoked", pairing_expires_at: "2026-09-01T00:00:00Z" },
        { id: "dev-no-expiry", kid_id: "kid-a", user_id: null, status: "pending", pairing_expires_at: null },
      ],
    });
    expect(plan(snap).expiredPairings.deviceIds).toEqual(["dev-expired"]);
  });
});

describe("planDemoReset: top-up", () => {
  it("targets the family treasury in base units", () => {
    expect(plan(snapshot(), "100").topup).toEqual({ dollars: "$100.00", units: 100_000_000n, walletAddress: "FamilyTreasury1111" });
    expect(plan(snapshot(), "$25.50").topup?.units).toBe(25_500_000n);
  });
  it("refuses without a treasury wallet, and refuses bad amounts", () => {
    expect(() => plan(snapshot({ wallets: [snapshot().wallets[1]] }), "100")).toThrow(/no treasury wallet/);
    expect(() => plan(snapshot(), "lots")).toThrow(/--topup needs a dollar amount/);
    expect(() => plan(snapshot(), "0")).toThrow(/above zero/);
    expect(() => plan(snapshot(), "1.2345678")).toThrow(/--topup needs a dollar amount/);
  });
});

describe("formatPlan", () => {
  it("says what changes, what does not, and whether this is a dry run", () => {
    const snap = snapshot({
      events: [event("e1", KID_A_DEVICE, "sent"), event("e2", KID_A_DEVICE, "sent"), event("e3", PARENT, "funded")],
      requests: [{ id: "r1", kid_id: "kid-a", type: "add_contact", status: "pending" }],
      limits: [{ id: "l-a", kid_id: "kid-a", pending_raise: { field: "daily_limit_units", units: 1, effective_at: "2026-09-07T09:00:00Z" } }],
    });
    const text = formatPlan(plan(snap, "100"), { dryRun: true, ata: "TreasuryAta1111" });
    expect(text).toContain("(dry run: nothing changes)");
    expect(text).toContain("Otter family (fam-1)");
    expect(text).toContain("since 2026-09-06T16:00:00.000Z");
    expect(text).toContain("mark 3 events from today as not counted");
    expect(text).toContain("Ari's device: 2 counted today -> 0");
    expect(text).toContain("Parent (parent@example.com): 1 counted today -> 0");
    expect(text).toContain("delete 1 row (pending 1)");
    expect(text).toContain("clear on 1 limits row (Ari)");
    expect(text).toContain("delete 0 unclaimed device rows");
    expect(text).toContain("mint $100.00 of test USDC to the family treasury FamilyTreasury1111 (token account TreasuryAta1111)");
    expect(text).toContain("Leaves alone: kids, wallets, contacts, allowances");
  });
  it("marks a live run and a skipped top-up", () => {
    const text = formatPlan(plan(snapshot()), { dryRun: false, ata: null });
    expect(text).not.toContain("dry run");
    expect(text).toContain("Top-up: none");
  });
});
