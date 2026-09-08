import { describe, expect, it } from "vitest";
import { cronAuthorized } from "@/lib/allowance/cron";

describe("cronAuthorized", () => {
  const secret = "a-long-random-cron-secret";

  it("accepts exactly `Bearer <secret>`", () => {
    expect(cronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("refuses a wrong, partial, or differently-cased header", () => {
    expect(cronAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
    expect(cronAuthorized(`Bearer ${secret.slice(0, -1)}`, secret)).toBe(false);
    expect(cronAuthorized(`bearer ${secret}`, secret)).toBe(false);
    expect(cronAuthorized(secret, secret)).toBe(false);
  });

  it("refuses when the header is missing or no secret is configured", () => {
    expect(cronAuthorized(null, secret)).toBe(false);
    expect(cronAuthorized(`Bearer ${secret}`, undefined)).toBe(false);
    expect(cronAuthorized("Bearer ", "")).toBe(false);
  });
});
