import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { destinationLimitActions } from "@/lib/swig/actions";

const mint = new PublicKey("DE54281uJtBv5Lob5A61q7DbDZ8jGrv4oJieFF5FoBJ4");
const dest = new PublicKey("6BCBDgdNzb7oMrmuZfyGcEDpkVAi5VexzQw7cEhJhrsL");

describe("destinationLimitActions", () => {
  it("always carries the program permission, so a replace-all update keeps the role able to transfer", () => {
    const actions = destinationLimitActions({ mint, windowSlots: 100n, limits: [{ destinationAta: dest, recurringAmount: 5n }], dailyTotal: 10n });
    const permissions = (actions as unknown as { actions: Array<{ payload: { permission: number } }> }).actions.map((a) => a.payload.permission);
    // 13 = ProgramAll, 19 = TokenRecurringDestinationLimit, 6 = TokenRecurringLimit
    expect(permissions).toContain(13);
    expect(permissions.filter((p) => p === 19)).toHaveLength(1);
    expect(permissions).toContain(6);
  });
});
