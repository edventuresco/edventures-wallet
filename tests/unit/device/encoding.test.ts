import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToBase64 } from "@/lib/device/encoding";

describe("base64 bytes", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array(300).map((_, i) => (i * 7) % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
  it("matches Buffer's encoding", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});
