import { describe, expect, it } from "vitest";
import { FAMILY_NAME_MAX, isGuardianLabel, validateFamilyName } from "@/lib/settings/family";

describe("validateFamilyName", () => {
  it("trims and collapses spaces", () => {
    expect(validateFamilyName("  The   Tans ")).toEqual({ ok: true, name: "The Tans" });
  });

  it("needs a name", () => {
    expect(validateFamilyName("   ")).toEqual({ ok: false, error: "Give the family a name." });
    expect(validateFamilyName(undefined as unknown as string)).toMatchObject({ ok: false });
  });

  it("keeps it short", () => {
    expect(validateFamilyName("a".repeat(FAMILY_NAME_MAX)).ok).toBe(true);
    expect(validateFamilyName("a".repeat(FAMILY_NAME_MAX + 1))).toMatchObject({ ok: false, error: expect.stringContaining(String(FAMILY_NAME_MAX)) });
  });
});

describe("isGuardianLabel", () => {
  it("accepts only Parent and Guardian", () => {
    expect(isGuardianLabel("Parent")).toBe(true);
    expect(isGuardianLabel("Guardian")).toBe(true);
    expect(isGuardianLabel("parent")).toBe(false);
    expect(isGuardianLabel("Mum")).toBe(false);
    expect(isGuardianLabel(null)).toBe(false);
  });
});
