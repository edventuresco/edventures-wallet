import { describe, expect, it } from "vitest";
import { buildKidDetailView, deviceChip, whenLabel, type DeviceRow, type KidDetailInput } from "@/lib/family/kid-detail";
import { dollarsToUnits } from "@/lib/money/usdc";
import { dateTimeLabel } from "@/lib/rules/family";

const TZ = "Asia/Kuching"; // UTC+8, no DST
const NOW = new Date("2026-09-10T06:00:00Z"); // Thursday 14:00 local

const units = (d: string) => Number(dollarsToUnits(d));

function device(overrides: Partial<DeviceRow> = {}): DeviceRow {
  return { status: "pending", joined: false, ...overrides };
}

describe("deviceChip", () => {
  it("says there is no device when there are no rows", () => {
    expect(deviceChip([], NOW)).toEqual({ label: "No device", paired: false });
  });

  it("is paired as soon as any device is active, whatever else is pending", () => {
    expect(deviceChip([device(), device({ status: "active", joined: true })], NOW)).toEqual({ label: "Paired", paired: true });
  });

  it("waits for the guardian once a pending device has been claimed", () => {
    expect(deviceChip([device({ joined: true })], NOW).label).toBe("Waiting for you");
  });

  it("stays at no device while an invited kid has not opened the email yet", () => {
    expect(deviceChip([device()], NOW).label).toBe("No device");
  });

  it("prefers a claimed device over an unclaimed row from an earlier attempt", () => {
    expect(deviceChip([device(), device({ joined: true })], NOW).label).toBe("Waiting for you");
  });
});

describe("whenLabel", () => {
  it("pairs the relative day with the clock in family time", () => {
    expect(whenLabel(new Date("2026-09-10T01:32:00Z"), NOW, TZ)).toBe("Today, 09:32");
    expect(whenLabel(new Date("2026-09-09T15:00:00Z"), NOW, TZ)).toBe("Yesterday, 23:00");
    expect(whenLabel(new Date("2026-09-08T02:05:00Z"), NOW, TZ)).toBe("Tuesday, 10:05");
  });
});

function input(overrides: Partial<KidDetailInput> = {}): KidDetailInput {
  return {
    now: NOW,
    timeZone: TZ,
    kid: { id: "kid_1", name: "Alex", avatar_id: "otter", birth_month: 3, birth_year: 2017 },
    wallets: [
      { kind: "spend", wallet_address: "SPEND_ADDR" },
      { kind: "save", wallet_address: "SAVE_ADDR" },
      { kind: "share", wallet_address: "SHARE_ADDR" },
    ],
    balances: { spend: dollarsToUnits("7.50"), save: dollarsToUnits("12"), share: dollarsToUnits("1.25") },
    devices: [],
    allowance: { amount_units: units("8"), next_run_at: "2026-09-14T01:00:00Z" },
    contacts: [
      { id: "c_mum", label: "Mum", avatar_id: "parent", weekly_limit_units: units("50"), status: "active", onchain_synced: true },
      { id: "c_sib", label: "Sam", avatar_id: "bunny", weekly_limit_units: units("5"), status: "active", onchain_synced: false },
      { id: "c_gone", label: "Old", avatar_id: "person", weekly_limit_units: units("2"), status: "removed", onchain_synced: true },
    ],
    limits: { daily_limit_units: units("40"), weekly_limit_units: units("90"), approval_threshold_units: units("15"), pending_raise: null, onchain_synced: true },
    events: [],
    ...overrides,
  };
}

describe("buildKidDetailView", () => {
  it("names the kid with their age, avatar and device state", () => {
    const view = buildKidDetailView(input({ devices: [device({ joined: true })] }));
    expect(view.kid).toEqual({ id: "kid_1", name: "Alex", avatarId: "otter", age: 9 });
    expect(view.device).toEqual({ label: "Waiting for you", paired: false });
    expect(buildKidDetailView(input({ kid: { id: "kid_1", name: "Alex", avatar_id: "otter", birth_month: null, birth_year: null } })).kid.age).toBeNull();
  });

  it("shows the three jars in order with a Solana link on each wallet", () => {
    const view = buildKidDetailView(input());
    expect(view.jars.map((j) => [j.kind, j.label, j.balance])).toEqual([
      ["spend", "Spend", "$7.50"],
      ["save", "Save", "$12.00"],
      ["share", "Share", "$1.25"],
    ]);
    expect(view.jars[0].explorerUrl).toContain("/address/SPEND_ADDR");
    expect(view.jars[2].explorerUrl).toContain("/address/SHARE_ADDR");
  });

  it("has no link for a jar whose wallet does not exist yet", () => {
    const view = buildKidDetailView(input({ wallets: [{ kind: "spend", wallet_address: "SPEND_ADDR" }], balances: { spend: 0n, save: 0n, share: 0n } }));
    expect(view.jars.map((j) => j.explorerUrl)).toEqual([expect.stringContaining("SPEND_ADDR"), null, null]);
    expect(view.jars.map((j) => j.balance)).toEqual(["$0.00", "$0.00", "$0.00"]);
  });

  it("writes the allowance line from the amount and the next Monday in family time", () => {
    const monday = dateTimeLabel(new Date("2026-09-14T01:00:00Z"), TZ);
    expect(buildKidDetailView(input()).allowance).toEqual({ line: `$8.00 a week, next ${monday}` });
    expect(buildKidDetailView(input({ allowance: null })).allowance).toBeNull();
  });

  it("lists only active contacts with their weekly cap and sync state", () => {
    expect(buildKidDetailView(input()).contacts).toEqual([
      { id: "c_mum", label: "Mum", emoji: "💛", weeklyCap: "$50.00", onchainSynced: true },
      { id: "c_sib", label: "Sam", emoji: "🐰", weeklyCap: "$5.00", onchainSynced: false },
    ]);
  });

  it("shows the limits in force and falls back to the kid defaults without a row", () => {
    expect(buildKidDetailView(input()).limits).toEqual({ daily: "$40.00", weekly: "$90.00", approval: "$15.00", onchainSynced: true, pendingLine: null });
    expect(buildKidDetailView(input({ limits: null })).limits).toEqual({ daily: "$50.00", weekly: "$100.00", approval: "$20.00", onchainSynced: false, pendingLine: null });
  });

  it("notes a raise that is still waiting and applies one whose time has come", () => {
    const waiting = { field: "daily_limit_units" as const, units: units("60"), effective_at: "2026-09-10T08:00:00Z" }; // 16:00 local
    const view = buildKidDetailView(input({ limits: { ...input().limits!, pending_raise: waiting } }));
    expect(view.limits.daily).toBe("$40.00");
    expect(view.limits.pendingLine).toBe("Daily limit goes up to $60.00. Applies at 16:00.");

    const due = { ...waiting, effective_at: "2026-09-10T05:00:00Z" };
    const applied = buildKidDetailView(input({ limits: { ...input().limits!, pending_raise: due } }));
    expect(applied.limits.daily).toBe("$60.00");
    expect(applied.limits.pendingLine).toBeNull();
  });

  it("keeps the newest ten events with a day label and a receipt link when signed", () => {
    const events = Array.from({ length: 12 }, (_, i) => ({
      id: `e${i}`,
      summary: `Event ${i}`,
      signature: i % 2 === 0 ? `sig${i}` : null,
      created_at: new Date(NOW.getTime() - i * 86_400_000).toISOString(),
    })).reverse(); // oldest first, to prove the view sorts
    const view = buildKidDetailView(input({ events }));
    expect(view.proof.map((p) => p.summary)).toEqual(Array.from({ length: 10 }, (_, i) => `Event ${i}`));
    expect(view.proof[0].whenLabel).toBe("Today, 14:00");
    expect(view.proof[1].whenLabel).toBe("Yesterday, 14:00");
    expect(view.proof[0].atLabel).toBe(dateTimeLabel(NOW, TZ));
    expect(view.proof[0].explorerUrl).toContain("/tx/sig0");
    expect(view.proof[1].explorerUrl).toBeNull();
  });
});
