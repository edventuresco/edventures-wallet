import { describe, expect, it } from "vitest";
import { allowanceEventRows } from "@/lib/allowance/events";
import { dollarsToUnits } from "@/lib/money/usdc";

describe("allowanceEventRows", () => {
  it("records the payment and its split as two events on the same signature", () => {
    const rows = allowanceEventRows({
      userId: "guardian-user",
      familyId: "fam",
      kidId: "kid",
      walletId: "spend-wallet",
      amountUnits: dollarsToUnits("10"),
      receipt: { signature: "sig123", split: { spend: 5_000_000n, save: 4_000_000n, share: 1_000_000n } },
    });
    expect(rows).toEqual([
      { user_id: "guardian-user", family_id: "fam", kid_id: "kid", wallet_id: "spend-wallet", amount_units: 10_000_000, signature: "sig123", kind: "allowance", summary: "Allowance of $10.00 paid" },
      { user_id: "guardian-user", family_id: "fam", kid_id: "kid", wallet_id: "spend-wallet", amount_units: 10_000_000, signature: "sig123", kind: "split", summary: "Split: $5.00 spend, $4.00 save, $1.00 share" },
    ]);
  });
});
