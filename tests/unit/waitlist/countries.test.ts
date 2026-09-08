import { describe, expect, it, vi } from "vitest";
import { COUNTRIES, COUNTRY_CODES, countryName, normalizeCountryCode } from "@/lib/waitlist/countries";

describe("COUNTRY_CODES", () => {
  it("is the full ISO 3166-1 alpha-2 set", () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
  });

  it("holds only two uppercase letters per code", () => {
    for (const code of COUNTRY_CODES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("includes the countries we know we serve", () => {
    for (const code of ["MY", "US", "NZ", "VN", "TH", "PH"]) expect(COUNTRY_CODES).toContain(code);
  });
});

describe("normalizeCountryCode", () => {
  it("accepts an assigned code", () => {
    expect(normalizeCountryCode("MY")).toBe("MY");
  });

  it("trims and uppercases", () => {
    expect(normalizeCountryCode("  my ")).toBe("MY");
  });

  it("returns null for anything not an assigned code", () => {
    expect(normalizeCountryCode("")).toBeNull();
    expect(normalizeCountryCode("ZZ")).toBeNull();
    expect(normalizeCountryCode("Malaysia")).toBeNull();
  });
});

describe("countryName", () => {
  it("names a code in English", () => {
    expect(countryName("MY")).toBe("Malaysia");
  });

  it("falls back to the code itself when there is no name", () => {
    expect(countryName("ZZ")).toBe("ZZ");
  });

  it("does not depend on the runtime's locale data, so the server and the browser render the same option text", async () => {
    // Node's ICU says "Falkland Islands"; Chrome's says "Falkland Islands (Islas Malvinas)". That mismatch broke hydration once.
    const original = Intl.DisplayNames;
    class Wrong {
      of() {
        return "WRONG";
      }
    }
    Object.defineProperty(Intl, "DisplayNames", { configurable: true, value: Wrong });
    vi.resetModules();
    try {
      const fresh = await import("@/lib/waitlist/countries");
      expect(fresh.countryName("FK")).toBe("Falkland Islands");
      expect(fresh.countryName("MY")).toBe("Malaysia");
      expect(fresh.COUNTRY_CODES.every((code) => fresh.countryName(code) !== code && fresh.countryName(code) !== "WRONG")).toBe(true);
    } finally {
      Object.defineProperty(Intl, "DisplayNames", { configurable: true, value: original });
      vi.resetModules();
    }
  });
});

describe("COUNTRIES", () => {
  it("is every code with its name, already in English alphabetical order, so no screen sorts with the runtime's collation", () => {
    expect(COUNTRIES).toHaveLength(COUNTRY_CODES.length);
    expect(COUNTRIES[0]).toEqual({ code: "AF", name: "Afghanistan" });
    expect(COUNTRIES[1]).toEqual({ code: "AX", name: "Åland Islands" });
    expect(COUNTRIES.at(-1)).toEqual({ code: "ZW", name: "Zimbabwe" });
  });
});
