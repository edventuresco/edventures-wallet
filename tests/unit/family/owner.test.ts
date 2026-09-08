import { describe, expect, it } from "vitest";
import { ownerNameFrom, possessive } from "@/lib/family/owner";

describe("ownerNameFrom", () => {
  it("takes the first word of the email's local part, capitalised", () => {
    expect(ownerNameFrom("mark@example.com")).toBe("Mark");
    expect(ownerNameFrom("mark.smith@example.com")).toBe("Mark");
    expect(ownerNameFrom("MARK_S-2@example.com")).toBe("Mark");
  });

  it("drops a +tag and copes with no email", () => {
    expect(ownerNameFrom("parent+zoe@example.com")).toBe("Parent");
    expect(ownerNameFrom(null)).toBe("You");
    expect(ownerNameFrom("+only@example.com")).toBe("You");
  });
});

describe("possessive", () => {
  it("adds 's, or just an apostrophe after an s", () => {
    expect(possessive("Mark")).toBe("Mark's");
    expect(possessive("James")).toBe("James'");
    expect(possessive("Serawak")).toBe("Serawak's");
  });
});
