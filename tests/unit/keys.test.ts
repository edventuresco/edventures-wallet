import { afterEach, describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { keypairFromBase58, keypairFromEnv, keypairToBase58 } from "@/lib/solana/keys";

describe("keys", () => {
  afterEach(() => {
    delete process.env.SPIKE_TEST_KEY;
  });

  it("round-trips a keypair through base58", () => {
    const kp = Keypair.generate();
    const back = keypairFromBase58(keypairToBase58(kp));
    expect(back.publicKey.equals(kp.publicKey)).toBe(true);
  });

  it("reads a keypair from an env var", () => {
    const kp = Keypair.generate();
    process.env.SPIKE_TEST_KEY = keypairToBase58(kp);
    expect(keypairFromEnv("SPIKE_TEST_KEY").publicKey.equals(kp.publicKey)).toBe(true);
  });

  it("names the missing env var in its error", () => {
    expect(() => keypairFromEnv("SPIKE_TEST_KEY")).toThrow(/SPIKE_TEST_KEY/);
  });
});
