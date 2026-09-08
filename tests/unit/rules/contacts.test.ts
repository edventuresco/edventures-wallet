import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { CONTACT_AVATAR_OPTIONS, validateContactRequest, validateNewContact } from "@/lib/rules/contacts";
import { dollarsToUnits } from "@/lib/money/usdc";

const ADDRESS = Keypair.generate().publicKey.toBase58();

describe("validateNewContact", () => {
  it("accepts a label, a known avatar, a Solana address and a weekly cap", () => {
    expect(validateNewContact({ label: "  Grandma ", avatarId: "person", address: ` ${ADDRESS} `, weeklyDollars: "20" })).toEqual({
      ok: true,
      contact: { label: "Grandma", avatarId: "person", address: ADDRESS, weeklyUnits: dollarsToUnits("20") },
    });
    expect(validateNewContact({ label: "Corner shop", avatarId: "shop", address: ADDRESS, weeklyDollars: "5.50" }).ok).toBe(true);
    expect(validateNewContact({ label: "Uncle", avatarId: "fox", address: ADDRESS, weeklyDollars: "5" }).ok).toBe(true);
  });

  it("rejects an empty or long label", () => {
    expect(validateNewContact({ label: "", avatarId: "person", address: ADDRESS, weeklyDollars: "20" })).toEqual({ ok: false, error: "Give this person a name." });
    expect(validateNewContact({ label: "x".repeat(25), avatarId: "person", address: ADDRESS, weeklyDollars: "20" }).ok).toBe(false);
  });

  it("rejects an unknown avatar", () => {
    expect(validateNewContact({ label: "Uncle", avatarId: "dragon", address: ADDRESS, weeklyDollars: "20" }).ok).toBe(false);
  });

  it("rejects anything that is not a Solana address", () => {
    expect(validateNewContact({ label: "Uncle", avatarId: "person", address: "not-an-address", weeklyDollars: "20" })).toEqual({
      ok: false,
      error: "That doesn't look like a Solana address. Paste the whole thing.",
    });
    expect(validateNewContact({ label: "Uncle", avatarId: "person", address: "", weeklyDollars: "20" }).ok).toBe(false);
  });

  it("rejects a weekly cap that is not a positive dollar amount", () => {
    expect(validateNewContact({ label: "Uncle", avatarId: "person", address: ADDRESS, weeklyDollars: "0" }).ok).toBe(false);
    expect(validateNewContact({ label: "Uncle", avatarId: "person", address: ADDRESS, weeklyDollars: "abc" }).ok).toBe(false);
    expect(validateNewContact({ label: "Uncle", avatarId: "person", address: ADDRESS, weeklyDollars: "-3" }).ok).toBe(false);
  });

  it("offers the specials first in the avatar options", () => {
    expect(CONTACT_AVATAR_OPTIONS.slice(0, 4).map((o) => o.id)).toEqual(["person", "parent", "family", "shop"]);
    expect(CONTACT_AVATAR_OPTIONS.every((o) => o.emoji.length > 0)).toBe(true);
  });
});

describe("validateContactRequest", () => {
  it("accepts a short name from the kid", () => {
    expect(validateContactRequest("  Grandpa  ")).toEqual({ ok: true, label: "Grandpa" });
  });

  it("rejects empty, long, or non-name input", () => {
    expect(validateContactRequest("").ok).toBe(false);
    expect(validateContactRequest("x".repeat(25)).ok).toBe(false);
    expect(validateContactRequest("<script>").ok).toBe(false);
  });
});
