import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signWebhookBody, verifyWebhookSignature } from "@/lib/sqril/hmac";

const secret = "whsec_test_0123456789";
const body = '{"tx_id":"tx_1","status":"SUCCESS","amount":100000,"fee":0.35}';

describe("Sqril webhook HMAC (base64)", () => {
  it("matches node:crypto's base64 HMAC-SHA256 for the same body", async () => {
    const expected = createHmac("sha256", secret).update(body).digest("base64");
    expect(await signWebhookBody(secret, body)).toBe(expected);
  });

  it("verifies a signature produced by Sqril's recipe", async () => {
    const sig = createHmac("sha256", secret).update(body).digest("base64");
    expect(await verifyWebhookSignature(secret, body, sig)).toBe(true);
  });

  it("accepts the URL-safe alphabet too", async () => {
    const sig = createHmac("sha256", secret).update(body).digest("base64url");
    expect(await verifyWebhookSignature(secret, body, sig)).toBe(true);
  });

  it("rejects a re-serialised body, a wrong secret, and a tampered signature", async () => {
    const sig = createHmac("sha256", secret).update(body).digest("base64");
    const reserialised = JSON.stringify(JSON.parse(body), null, 2);
    expect(await verifyWebhookSignature(secret, reserialised, sig)).toBe(false);
    expect(await verifyWebhookSignature("other", body, sig)).toBe(false);
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(await verifyWebhookSignature(secret, body, flipped)).toBe(false);
  });

  it("rejects missing, hex, and wrong-length signatures", async () => {
    const hex = createHmac("sha256", secret).update(body).digest("hex");
    expect(await verifyWebhookSignature(secret, body, null)).toBe(false);
    expect(await verifyWebhookSignature(secret, body, "")).toBe(false);
    expect(await verifyWebhookSignature(secret, body, hex)).toBe(false);
    expect(await verifyWebhookSignature(secret, body, "AAAA")).toBe(false);
  });
});
