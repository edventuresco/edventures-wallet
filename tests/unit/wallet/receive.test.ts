import { describe, expect, it } from "vitest";
import { receiveUri, shortAddress } from "@/lib/wallet/receive";

describe("receiveUri", () => {
  it("is a Solana Pay request for this wallet and the family's dollar", () => {
    const uri = receiveUri("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    expect(uri).toBe("solana:9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin?spl-token=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU&label=Edventures%20Wallet");
  });
});

describe("shortAddress", () => {
  it("keeps the ends and elides the middle", () => {
    expect(shortAddress("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin")).toBe("9xQe…VFin");
    expect(shortAddress("short")).toBe("short");
  });
});
