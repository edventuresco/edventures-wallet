import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { redactWebhookPayload, sha256Hex, verifyWebhookRequest } from "@/lib/sqril/webhook";

const secret = "whsec_test";
const body = '{"tx_id":"tx_9","status":"SUCCESS","amount":120000,"fee":0.15}';
const sign = (b: string, s = secret) => createHmac("sha256", s).update(b).digest("base64");

describe("verifyWebhookRequest", () => {
  it("accepts a correctly signed success payload", async () => {
    const v = await verifyWebhookRequest({ rawBody: body, signature: sign(body), secret });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.kind).toBe("transaction");
      expect(v.payload).toMatchObject({ tx_id: "tx_9", status: "SUCCESS" });
    }
  });

  it("fails closed when no secret is configured, even if a signature is present", async () => {
    const v = await verifyWebhookRequest({ rawBody: body, signature: sign(body), secret: undefined });
    expect(v).toMatchObject({ ok: false, reason: "no_secret", httpStatus: 503, signaturePresent: true });
  });

  it("rejects missing and wrong signatures with 401", async () => {
    expect(await verifyWebhookRequest({ rawBody: body, signature: null, secret })).toMatchObject({ reason: "missing_signature", httpStatus: 401 });
    expect(await verifyWebhookRequest({ rawBody: body, signature: sign(body, "other"), secret })).toMatchObject({ reason: "bad_signature", httpStatus: 401 });
  });

  it("rejects signed non-JSON with 400", async () => {
    const notJson = "not json";
    expect(await verifyWebhookRequest({ rawBody: notJson, signature: sign(notJson), secret })).toMatchObject({ reason: "bad_json", httpStatus: 400 });
  });

  it("acknowledges signed events it does not model (pending, processing, account.*)", async () => {
    for (const b of ['{"tx_id":"t","status":"PENDING"}', '{"tx_id":"t","status":"PROCESSING"}', '{"event":"account.balance.updated","balance":12.5}']) {
      const v = await verifyWebhookRequest({ rawBody: b, signature: sign(b), secret });
      expect(v.ok).toBe(true);
      if (v.ok) expect(v.kind).toBe("other");
    }
  });

  it("accepts FAILED and REFUNDED", async () => {
    for (const status of ["FAILED", "REFUNDED"]) {
      const b = JSON.stringify({ tx_id: "t", status });
      expect((await verifyWebhookRequest({ rawBody: b, signature: sign(b), secret })).ok).toBe(true);
    }
  });
});

describe("redactWebhookPayload", () => {
  it("drops the sender's KYC record and the recipient's account details", () => {
    const out = redactWebhookPayload({
      tx_id: "t",
      status: "SUCCESS",
      amount: 79000,
      fee: 0.03,
      sender: { name_first: "Test", name_last: "Parent", ic_number: "900101130000", address: "1 Jalan Test" },
      recipient: { name_first: "NGUYEN", name_last: "VAN A", country: "VN", account_no: "113366668888", bank_code: "970415" },
    });
    expect(out).toEqual({ tx_id: "t", status: "SUCCESS", amount: 79000, fee: 0.03, recipient: { name: "NGUYEN VAN A", country: "VN" } });
    expect(JSON.stringify(out)).not.toMatch(/900101130000|113366668888|Jalan/);
  });

  it("hashes the raw body deterministically", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
