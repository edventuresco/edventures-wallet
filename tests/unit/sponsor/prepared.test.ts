import { beforeAll, describe, expect, it } from "vitest";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { issuePreparedToken, messageHashOf, verifyPreparedToken } from "@/lib/sponsor/prepared";

beforeAll(() => {
  process.env.PREPARED_TX_SECRET = "test-secret-at-least-32-characters-long!!";
});

describe("prepared transaction tokens", () => {
  it("round-trips and binds to the message hash", async () => {
    const token = await issuePreparedToken({ userId: "u1", messageHash: "abc", purpose: "transfer" });
    expect(await verifyPreparedToken(token)).toEqual({ userId: "u1", messageHash: "abc", purpose: "transfer" });
  });

  it("rejects a tampered token", async () => {
    const token = await issuePreparedToken({ userId: "u1", messageHash: "abc", purpose: "transfer" });
    expect(await verifyPreparedToken(token.slice(0, -2) + "xx")).toBeNull();
  });

  it("hashes the message, not the signatures", () => {
    const a = Keypair.generate();
    const b = Keypair.generate();
    const tx = new Transaction({ recentBlockhash: "11111111111111111111111111111111", feePayer: b.publicKey }).add(
      SystemProgram.transfer({ fromPubkey: a.publicKey, toPubkey: b.publicKey, lamports: 1 }),
    );
    const before = messageHashOf(tx);
    tx.partialSign(a);
    expect(messageHashOf(tx)).toBe(before);
  });
});
