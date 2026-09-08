import { describe, expect, it } from "vitest";
import { payerHome, payerKidId, payerWalletLabel, type Payer } from "@/lib/shop/payer";

const kid: Payer = { kind: "kid", familyId: "f", userId: "u", kidId: "k", deviceId: "d" };
const parent: Payer = { kind: "guardian", familyId: "f", userId: "u" };

describe("payer", () => {
  it("names the wallet, the kid and the way home for each payer", () => {
    expect(payerWalletLabel(kid)).toBe("Spend jar");
    expect(payerWalletLabel(parent)).toBe("family wallet");
    expect(payerKidId(kid)).toBe("k");
    expect(payerKidId(parent)).toBeNull();
    expect(payerHome(kid)).toBe("/kid");
    expect(payerHome(parent)).toBe("/");
  });
});
