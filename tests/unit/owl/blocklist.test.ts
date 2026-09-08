import { describe, expect, it } from "vitest";
import { containsBlockedWord, normalizeForBlocklistMatch } from "@/lib/owl/blocklist";

describe("normalizeForBlocklistMatch", () => {
  it("maps leetspeak digits back to letters", () => {
    expect(normalizeForBlocklistMatch("sh1t")).toBe("shit");
    expect(normalizeForBlocklistMatch("4ss")).toBe("as"); // 4→a, then "ass" collapses to "as"
    expect(normalizeForBlocklistMatch("b1tch")).toBe("bitch");
  });

  it("strips non-letter characters", () => {
    expect(normalizeForBlocklistMatch("f.u.c.k")).toBe("fuck");
    expect(normalizeForBlocklistMatch("f u c k")).toBe("fuck");
  });

  it("collapses repeated letters", () => {
    expect(normalizeForBlocklistMatch("fuuuuck")).toBe("fuck");
    expect(normalizeForBlocklistMatch("Pip")).toBe("pip"); // no repeats to collapse
  });

  it("lowercases", () => {
    expect(normalizeForBlocklistMatch("SHIT")).toBe("shit");
  });
});

describe("containsBlockedWord", () => {
  it("flags a plain blocklisted word", () => {
    expect(containsBlockedWord("fuck")).toBe(true);
  });

  it("flags digit-based leetspeak variants", () => {
    expect(containsBlockedWord("sh1t")).toBe(true);
    expect(containsBlockedWord("b1tch")).toBe(true);
    expect(containsBlockedWord("a55hole")).toBe(true);
  });

  it("flags a word embedded in a longer string", () => {
    expect(containsBlockedWord("superfuckawesome")).toBe(true);
  });

  it("does not flag an innocent name", () => {
    expect(containsBlockedWord("Pip")).toBe(false);
    expect(containsBlockedWord("Sir Hoot")).toBe(false);
    expect(containsBlockedWord("Whisper-Wing")).toBe(false);
  });
});
