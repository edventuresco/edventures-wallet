import { describe, expect, it } from "vitest";
import { AVATARS, DEFAULT_AVATAR_ID, avatarById } from "@/lib/avatars";

describe("AVATARS", () => {
  it("has exactly 23 entries", () => {
    expect(AVATARS).toHaveLength(23);
  });

  it("has unique ids", () => {
    const ids = AVATARS.map((avatar) => avatar.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every emoji entry an emoji", () => {
    const emojiAvatars = AVATARS.filter((avatar) => avatar.kind === "emoji");
    expect(emojiAvatars.length).toBeGreaterThan(0);
    for (const avatar of emojiAvatars) {
      expect(avatar.emoji).toBeTruthy();
    }
  });

  it("gives every illustrated entry a src under /illustrations/", () => {
    const illustrated = AVATARS.filter((avatar) => avatar.kind === "illustrated");
    expect(illustrated.length).toBe(3);
    for (const avatar of illustrated) {
      expect(avatar.src).toMatch(/^\/illustrations\//);
    }
  });

  it("gives every avatar a label", () => {
    for (const avatar of AVATARS) {
      expect(avatar.label.length).toBeGreaterThan(0);
    }
  });

  it("has a default id that matches a real avatar", () => {
    expect(AVATARS.some((avatar) => avatar.id === DEFAULT_AVATAR_ID)).toBe(true);
  });
});

describe("avatarById", () => {
  it("returns the matching avatar", () => {
    expect(avatarById("maya").label).toBe("Maya");
    expect(avatarById("maya").src).toBe("/illustrations/avatar-maya.png");
  });

  it("falls back to the default avatar for an unknown id", () => {
    expect(avatarById("not-a-real-id").id).toBe(DEFAULT_AVATAR_ID);
  });

  it("falls back to the default avatar for null or undefined", () => {
    expect(avatarById(null).id).toBe(DEFAULT_AVATAR_ID);
    expect(avatarById(undefined).id).toBe(DEFAULT_AVATAR_ID);
  });
});
