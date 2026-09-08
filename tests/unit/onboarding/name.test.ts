import { describe, expect, it } from "vitest";
import { DISPLAY_NAME_MAX, validateDisplayName } from "@/lib/onboarding/name";

describe("validateDisplayName", () => {
  it("trims and collapses spaces", () => {
    expect(validateDisplayName("  Mark   Smith ")).toEqual({ ok: true, name: "Mark Smith" });
  });
  it("needs a name", () => {
    expect(validateDisplayName("   ").ok).toBe(false);
  });
  it("keeps it short", () => {
    expect(validateDisplayName("a".repeat(DISPLAY_NAME_MAX)).ok).toBe(true);
    expect(validateDisplayName("a".repeat(DISPLAY_NAME_MAX + 1)).ok).toBe(false);
  });
});
