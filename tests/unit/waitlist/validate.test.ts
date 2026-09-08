import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/lib/waitlist/validate";

describe("normalizeEmail", () => {
  it("accepts a valid email", () => {
    expect(normalizeEmail("parent@example.com")).toBe("parent@example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  parent@example.com  ")).toBe("parent@example.com");
  });

  it("lowercases the email", () => {
    expect(normalizeEmail("Parent@Example.COM")).toBe("parent@example.com");
  });

  it("rejects an invalid email", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("missing-domain@")).toBeNull();
    expect(normalizeEmail("@missing-local.com")).toBeNull();
    expect(normalizeEmail("no spaces@example.com")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });
});

it("rejects absurdly long addresses", () => {
  expect(normalizeEmail(`${"a".repeat(250)}@example.com`)).toBeNull();
});