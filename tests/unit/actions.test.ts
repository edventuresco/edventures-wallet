import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { destinationLimitActions, rootActions } from "@/lib/swig/actions";

describe("role actions", () => {
  it("builds one destination limit per contact and nothing else", () => {
    const mint = Keypair.generate().publicKey;
    const two = destinationLimitActions({
      mint,
      windowSlots: 3_024_000n,
      limits: [
        { destinationAta: Keypair.generate().publicKey, recurringAmount: 5_000_000n },
        { destinationAta: Keypair.generate().publicKey, recurringAmount: 3_000_000n },
      ],
    });
    const one = destinationLimitActions({
      mint,
      windowSlots: 3_024_000n,
      limits: [{ destinationAta: Keypair.generate().publicKey, recurringAmount: 5_000_000n }],
    });
    // Actions serialise to bytes; two limits must be longer than one.
    expect(two.bytes().length).toBeGreaterThan(one.bytes().length);
  });

  it("adds a general cap only when asked (spike check 13)", () => {
    const mint = Keypair.generate().publicKey;
    const limits = [{ destinationAta: Keypair.generate().publicKey, recurringAmount: 5_000_000n }];
    const plain = destinationLimitActions({ mint, windowSlots: 1n, limits });
    const capped = destinationLimitActions({ mint, windowSlots: 1n, limits, dailyTotal: 4_000_000n });
    expect(capped.bytes().length).toBeGreaterThan(plain.bytes().length);
  });

  it("refuses an empty contact list (a role with no permissions is a bug)", () => {
    expect(() =>
      destinationLimitActions({ mint: Keypair.generate().publicKey, windowSlots: 1n, limits: [] }),
    ).toThrow(/at least one/);
  });

  it("root actions are the full permission set", () => {
    expect(rootActions().bytes().length).toBeGreaterThan(0);
  });
});
