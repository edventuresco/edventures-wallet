import { describe, expect, it } from "vitest";
import { checkOwlName } from "@/lib/owl/name";

describe("checkOwlName — accepts", () => {
  it("accepts a short simple name", () => {
    expect(checkOwlName("Pip")).toEqual({ ok: true, name: "Pip" });
  });

  it("accepts a two-word name", () => {
    expect(checkOwlName("Sir Hoot")).toEqual({ ok: true, name: "Sir Hoot" });
  });

  it("accepts a hyphenated name", () => {
    expect(checkOwlName("Whisper-Wing")).toEqual({ ok: true, name: "Whisper-Wing" });
  });

  it("trims surrounding whitespace and collapses internal runs", () => {
    expect(checkOwlName("  Sir   Hoot  ")).toEqual({ ok: true, name: "Sir Hoot" });
  });
});

describe("checkOwlName — length", () => {
  it("rejects a single character (too short)", () => {
    expect(checkOwlName("A")).toEqual({ ok: false });
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(checkOwlName("")).toEqual({ ok: false });
    expect(checkOwlName("   ")).toEqual({ ok: false });
  });

  it("rejects a name longer than 16 characters", () => {
    expect(checkOwlName("Professor Wingdington")).toEqual({ ok: false });
  });

  it("accepts exactly 16 characters", () => {
    expect("Abcdefghijklmnop").toHaveLength(16);
    expect(checkOwlName("Abcdefghijklmnop")).toEqual({ ok: true, name: "Abcdefghijklmnop" });
  });
});

describe("checkOwlName — character rules", () => {
  it("rejects digits", () => {
    expect(checkOwlName("Pip3")).toEqual({ ok: false });
    expect(checkOwlName("0wl")).toEqual({ ok: false });
  });

  it("rejects punctuation and symbols", () => {
    expect(checkOwlName("Pip!")).toEqual({ ok: false });
    expect(checkOwlName("Pip_Owl")).toEqual({ ok: false });
    expect(checkOwlName("Pip@Home")).toEqual({ ok: false });
  });

  it("rejects a leading or trailing hyphen", () => {
    expect(checkOwlName("-Pip")).toEqual({ ok: false });
    expect(checkOwlName("Pip-")).toEqual({ ok: false });
  });
});

describe("checkOwlName — blocklist", () => {
  it("rejects a plain blocklisted word", () => {
    expect(checkOwlName("fuck")).toEqual({ ok: false });
    expect(checkOwlName("Shit")).toEqual({ ok: false });
  });

  it("rejects a blocklisted word embedded in a longer name", () => {
    expect(checkOwlName("Bigbitch")).toEqual({ ok: false });
  });

  it("rejects a letter-repetition obfuscation (no digits needed)", () => {
    expect(checkOwlName("Fuuuuck")).toEqual({ ok: false });
    expect(checkOwlName("Shhhiiit")).toEqual({ ok: false });
  });

  it("rejects a hyphen/space-separated obfuscation", () => {
    expect(checkOwlName("F-u-c-k")).toEqual({ ok: false });
  });

  it("rejects a slur", () => {
    expect(checkOwlName("Nazi")).toEqual({ ok: false });
  });

  it("never echoes the rejected name back", () => {
    const result = checkOwlName("fuck");
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("fuck");
  });
});
