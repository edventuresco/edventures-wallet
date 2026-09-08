import { describe, expect, it } from "vitest";
import { formatPlan, parseRootMoveArgs, planRootMove, type RootMoveSnapshot } from "@/lib/recovery/root-key";

const PARENT = "user-parent";
const OLD_KEY = "OldKey1111111111111111111111111111111111111";
const NEW_KEY = "NewKey1111111111111111111111111111111111111";
const KID_KEY = "KidKey1111111111111111111111111111111111111";

function snapshot(overrides: Partial<RootMoveSnapshot> = {}): RootMoveSnapshot {
  return {
    family: { id: "fam-1", name: "Otter family", keeper_role_id: 1 },
    guardians: [{ user_id: PARENT }],
    kids: [
      { id: "kid-a", name: "Ari" },
      { id: "kid-b", name: "Bo" },
    ],
    devices: [
      { id: "dev-old", user_id: PARENT, kid_id: null, pubkey: OLD_KEY, status: "active" },
      { id: "dev-new", user_id: PARENT, kid_id: null, pubkey: NEW_KEY, status: "active" },
      { id: "dev-a", user_id: "user-kid-a", kid_id: "kid-a", pubkey: KID_KEY, status: "active" },
      { id: "dev-b-placeholder", user_id: null, kid_id: "kid-b", pubkey: "pending:xyz", status: "pending" },
    ],
    wallets: [
      { id: "w-family", kid_id: null, kind: "family", swig_address: "SwigF", wallet_address: "FamilyTreasury1111", rootPubkey: OLD_KEY, balanceUnits: 24_500_000n },
      { id: "w-a-spend", kid_id: "kid-a", kind: "spend", swig_address: "SwigAS", wallet_address: "AriSpend1111", rootPubkey: OLD_KEY, balanceUnits: 2_000_000n },
      { id: "w-a-save", kid_id: "kid-a", kind: "save", swig_address: "SwigAV", wallet_address: "AriSave1111", rootPubkey: OLD_KEY, balanceUnits: 0n },
      { id: "w-b-spend", kid_id: "kid-b", kind: "spend", swig_address: "SwigBS", wallet_address: "BoSpend1111", rootPubkey: OLD_KEY, balanceUnits: 1_000_000n },
    ],
    contacts: [
      { id: "c-a-mum", kid_id: "kid-a", address: "FamilyTreasury1111" },
      { id: "c-a-bo", kid_id: "kid-a", address: "BoSpend1111" },
      { id: "c-a-outside", kid_id: "kid-a", address: "SomeoneElse1111" },
    ],
    ...overrides,
  };
}

describe("planRootMove", () => {
  it("recreates every wallet the old key roots, rewrites the contacts that point at them, and resets what root had granted", () => {
    const plan = planRootMove(snapshot(), { toPubkey: NEW_KEY });

    expect(plan.newDevice).toEqual({ id: "dev-new", pubkey: NEW_KEY, userId: PARENT });
    expect(plan.retireDeviceIds).toEqual(["dev-old"]);
    expect(plan.wallets.map((w) => [w.id, w.who, w.balanceUnits])).toEqual([
      ["w-family", "the family wallet", 24_500_000n],
      ["w-a-spend", "Ari's spend", 2_000_000n],
      ["w-a-save", "Ari's save", 0n],
      ["w-b-spend", "Bo's spend", 1_000_000n],
    ]);
    expect(plan.contacts).toEqual([
      { id: "c-a-mum", oldAddress: "FamilyTreasury1111" },
      { id: "c-a-bo", oldAddress: "BoSpend1111" },
    ]);
    expect(plan.reapproveDevices).toEqual([{ id: "dev-a", kidName: "Ari" }]);
    expect(plan.keeperWasOn).toBe(true);
  });

  it("leaves a wallet alone when the chain already says the new key is its root", () => {
    const snap = snapshot();
    snap.wallets[0].rootPubkey = NEW_KEY;
    const plan = planRootMove(snap, { toPubkey: NEW_KEY });
    expect(plan.wallets.map((w) => w.id)).toEqual(["w-a-spend", "w-a-save", "w-b-spend"]);
    // The treasury keeps its address, so the contact that points at it stays.
    expect(plan.contacts.map((c) => c.id)).toEqual(["c-a-bo"]);
  });

  it("refuses when nothing needs moving", () => {
    const snap = snapshot({ wallets: snapshot().wallets.map((w) => ({ ...w, rootPubkey: NEW_KEY })) });
    expect(() => planRootMove(snap, { toPubkey: NEW_KEY })).toThrow(/already has .* as root/);
  });

  it("refuses a key that is not a registered guardian device", () => {
    expect(() => planRootMove(snapshot(), { toPubkey: "Unknown111" })).toThrow(/Open Settings on that browser first/);
    expect(() => planRootMove(snapshot({ guardians: [{ user_id: "someone-else" }] }), { toPubkey: NEW_KEY })).toThrow(/does not belong to a guardian/);
  });

  it("does not revoke a device that is already revoked, nor the new one", () => {
    const snap = snapshot();
    snap.devices[0].status = "revoked";
    expect(planRootMove(snap, { toPubkey: NEW_KEY }).retireDeviceIds).toEqual([]);
  });

  it("prints a plan a person can check", () => {
    const text = formatPlan(planRootMove(snapshot(), { toPubkey: NEW_KEY }), { dryRun: true });
    expect(text).toContain('Dry run for "Otter family"');
    expect(text).toContain("the family wallet: Fami…1111 → new, then $24.50 minted back");
    expect(text).toContain("Kid devices back to pending, for approval again in Family: Ari");
    expect(text).toContain("was on; switched off");
  });
});

describe("parseRootMoveArgs", () => {
  it("reads the flags in either form", () => {
    expect(parseRootMoveArgs(["--family", "parent@example.com", "--to=" + NEW_KEY, "--dry-run"])).toEqual({ family: "parent@example.com", to: NEW_KEY, dryRun: true, yes: false, help: false });
  });
  it("needs both --family and --to", () => {
    expect(() => parseRootMoveArgs(["--to", NEW_KEY])).toThrow(/--family is required/);
    expect(() => parseRootMoveArgs(["--family", "fam"])).toThrow(/--to is required/);
    expect(() => parseRootMoveArgs(["--bogus"])).toThrow(/Unknown option/);
  });
});
