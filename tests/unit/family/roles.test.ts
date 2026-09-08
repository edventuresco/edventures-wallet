import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { kidRolePlans, RULE_SYNC_WALLETS } from "@/lib/family/roles";

const pk = () => Keypair.generate().publicKey;

function input(contacts: number) {
  return {
    mint: pk(),
    weeklySlots: 3_024_000n,
    dailySlots: 432_000n,
    atas: { spend: pk(), save: pk(), share: pk() },
    contactLimits: Array.from({ length: contacts }, () => ({ destinationAta: pk(), recurringAmount: 50_000_000n })),
    dailyLimitUnits: 50_000_000n,
    jarWeeklyUnits: 500_000_000n,
  };
}

describe("kidRolePlans", () => {
  it("returns one plan per wallet kind, in spend / save / share order", () => {
    expect(kidRolePlans(input(2)).map((p) => p.kind)).toEqual(["spend", "save", "share"]);
  });

  it("spend carries the contacts, both jars and the daily total, so it grows with the list", () => {
    const one = kidRolePlans(input(1)).find((p) => p.kind === "spend")!;
    const three = kidRolePlans(input(3)).find((p) => p.kind === "spend")!;
    expect(three.actions.bytes().length).toBeGreaterThan(one.actions.bytes().length);
  });

  it("share follows the contact list and falls back to the spend jar when the list is empty", () => {
    const none = kidRolePlans(input(0)).find((p) => p.kind === "share")!;
    const two = kidRolePlans(input(2)).find((p) => p.kind === "share")!;
    expect(none.actions.bytes().length).toBeGreaterThan(0);
    expect(two.actions.bytes().length).toBeGreaterThan(none.actions.bytes().length);
  });

  it("save does not change with the contact list (it only sends back to spend)", () => {
    const none = kidRolePlans(input(0)).find((p) => p.kind === "save")!;
    const two = kidRolePlans(input(2)).find((p) => p.kind === "save")!;
    expect(two.actions.bytes().length).toBe(none.actions.bytes().length);
  });

  it("a rule sync rewrites only the wallets that depend on the rules", () => {
    expect(RULE_SYNC_WALLETS).toEqual(["spend", "share"]);
  });
});
