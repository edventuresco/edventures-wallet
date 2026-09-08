import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { DEFAULTS } from "@/lib/family/defaults";
import { keeperActions } from "@/lib/family/keeper";
import { destinationLimitActions } from "@/lib/swig/actions";

const pk = () => Keypair.generate().publicKey;

describe("keeperActions", () => {
  const mint = pk();
  const windowSlots = 3_024_000n;

  it("encodes the weekly cap on the mint", () => {
    const actions = keeperActions({ mint, weeklyUnits: DEFAULTS.keeperWeeklyUnits, windowSlots });
    expect(actions.bytes().length).toBeGreaterThan(0);
    const other = keeperActions({ mint, weeklyUnits: DEFAULTS.keeperWeeklyUnits + 1n, windowSlots });
    expect(Buffer.from(other.bytes()).equals(Buffer.from(actions.bytes()))).toBe(false);
  });

  it("carries no destination list, so it is smaller than a one-contact whitelist", () => {
    const keeper = keeperActions({ mint, weeklyUnits: DEFAULTS.keeperWeeklyUnits, windowSlots });
    const whitelist = destinationLimitActions({ mint, windowSlots, limits: [{ destinationAta: pk(), recurringAmount: 1n }] });
    expect(keeper.bytes().length).toBeLessThan(whitelist.bytes().length);
  });

  it("refuses a zero cap or window", () => {
    expect(() => keeperActions({ mint, weeklyUnits: 0n, windowSlots })).toThrow(/positive/);
    expect(() => keeperActions({ mint, weeklyUnits: 1n, windowSlots: 0n })).toThrow(/positive/);
  });

  it("defaults to $200 a week", () => {
    expect(DEFAULTS.keeperWeeklyUnits).toBe(200_000_000n);
  });
});
