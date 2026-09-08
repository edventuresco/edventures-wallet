import { describe, expect, it } from "vitest";
import { adminEmails, isAdminEmail, isWaitlistStatus, mayCreateAccount } from "@/lib/waitlist/access";

const env = { ADMIN_EMAILS: "admin@example.com, Second.Admin@Example.com" };

describe("adminEmails", () => {
  it("reads a comma-separated list, trimmed and lower-cased", () => {
    expect(adminEmails(env)).toEqual(["admin@example.com", "second.admin@example.com"]);
  });
  it("is empty when nothing is configured", () => {
    expect(adminEmails({})).toEqual([]);
    expect(adminEmails({ ADMIN_EMAILS: " , " })).toEqual([]);
  });
});

describe("isAdminEmail", () => {
  it("knows the admins, whatever the case or spacing", () => {
    expect(isAdminEmail("admin@example.com", env)).toBe(true);
    expect(isAdminEmail("  Admin@Example.com ", env)).toBe(true);
    expect(isAdminEmail("second.admin@example.com", env)).toBe(true);
  });
  it("is nobody else", () => {
    expect(isAdminEmail("parent@example.com", env)).toBe(false);
    expect(isAdminEmail("", env)).toBe(false);
    expect(isAdminEmail(null, env)).toBe(false);
  });
  it("is nobody when the list is unset", () => {
    expect(isAdminEmail("admin@example.com", {})).toBe(false);
  });
});

describe("mayCreateAccount", () => {
  it("lets an accepted email make an account", () => {
    expect(mayCreateAccount({ email: "parent@example.com", status: "accepted" }, env)).toBe(true);
  });
  it("keeps a waiting, declined or unknown email out", () => {
    expect(mayCreateAccount({ email: "parent@example.com", status: "waiting" }, env)).toBe(false);
    expect(mayCreateAccount({ email: "parent@example.com", status: "declined" }, env)).toBe(false);
    expect(mayCreateAccount({ email: "parent@example.com", status: null }, env)).toBe(false);
  });
  it("always lets an admin in", () => {
    expect(mayCreateAccount({ email: "admin@example.com", status: null }, env)).toBe(true);
  });
});

describe("isWaitlistStatus", () => {
  it("accepts the three statuses and nothing else", () => {
    expect(isWaitlistStatus("waiting")).toBe(true);
    expect(isWaitlistStatus("accepted")).toBe(true);
    expect(isWaitlistStatus("declined")).toBe(true);
    expect(isWaitlistStatus("approved")).toBe(false);
    expect(isWaitlistStatus(undefined)).toBe(false);
  });
});
