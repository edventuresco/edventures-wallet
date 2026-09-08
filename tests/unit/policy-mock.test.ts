import { beforeEach, describe, expect, it } from "vitest";
import { MockPolicyEngine } from "@/lib/policy/mock";
import { dollarsToUnits } from "@/lib/money/usdc";

const MUM = "MumAddress111111111111111111111111111111111";
const STRANGER = "StrangerAddress11111111111111111111111111111";
const DAY = 86_400_000;

describe("MockPolicyEngine", () => {
  let engine: MockPolicyEngine;
  const t0 = Date.UTC(2026, 8, 7);

  beforeEach(async () => {
    engine = new MockPolicyEngine();
    await engine.setRules("kid", {
      weeklyLimitsByContact: { [MUM]: dollarsToUnits("5") },
      allowedPrograms: [],
    });
  });

  it("blocks a kid with no rules", async () => {
    const decision = await engine.checkTransfer({ kidId: "nobody", toAddress: MUM, units: 1n });
    expect(decision).toEqual({ allowed: false, reason: "no_rules" });
  });

  it("blocks anyone not on the list", async () => {
    const decision = await engine.checkTransfer({ kidId: "kid", toAddress: STRANGER, units: 1n });
    expect(decision).toEqual({ allowed: false, reason: "not_on_list" });
  });

  it("allows a listed person within the weekly limit", async () => {
    const decision = await engine.checkTransfer({ kidId: "kid", toAddress: MUM, units: dollarsToUnits("2") });
    expect(decision).toEqual({ allowed: true });
  });

  it("blocks once the rolling week is used up, then allows again a week later", async () => {
    const send = (dollars: string, nowMs: number) => ({ kidId: "kid", toAddress: MUM, units: dollarsToUnits(dollars), nowMs });
    await engine.noteTransfer(send("3", t0));
    await engine.noteTransfer(send("2", t0 + DAY));

    const blocked = await engine.checkTransfer(send("0.01", t0 + 2 * DAY));
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.reason).toBe("over_limit");
      expect(blocked.detail).toEqual({ limitUnits: dollarsToUnits("5"), spentUnits: dollarsToUnits("5") });
    }

    const later = await engine.checkTransfer(send("3", t0 + 8 * DAY));
    expect(later).toEqual({ allowed: true });
  });
});
