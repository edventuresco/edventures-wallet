import { describe, expect, it } from "vitest";
import { interpretWithRules, type OwlContext } from "@/lib/owl/intent";

const baseContext: OwlContext = {
  kidName: "Aria",
  owlName: "Pip",
  balanceDisplay: "$12.50",
  contacts: [
    { id: "c-grandma", label: "Grandma" },
    { id: "c-mum", label: "Mum" },
  ],
  jarBalanceDisplay: "$5.00",
};

describe("interpretWithRules — balance", () => {
  it("answers a plain balance question", () => {
    expect(interpretWithRules("How much do I have?", baseContext)).toEqual({
      kind: "say",
      text: "You have $12.50.",
    });
  });

  it("matches other 'how much' phrasings", () => {
    expect(interpretWithRules("how much money do I have", baseContext)).toEqual({
      kind: "say",
      text: "You have $12.50.",
    });
  });
});

describe("interpretWithRules — send", () => {
  it("matches a contact case-insensitively", () => {
    expect(interpretWithRules("send $2 to grandma", baseContext)).toEqual({
      kind: "propose_send",
      contactId: "c-grandma",
      dollars: "2",
      say: "Send $2 to Grandma?",
    });
  });

  it("accepts the 'X dollars' phrasing", () => {
    expect(interpretWithRules("send 5 dollars to Mum", baseContext)).toEqual({
      kind: "propose_send",
      contactId: "c-mum",
      dollars: "5",
      say: "Send $5 to Mum?",
    });
  });

  it("accepts cents", () => {
    expect(interpretWithRules("send $2.50 to Grandma", baseContext)).toEqual({
      kind: "propose_send",
      contactId: "c-grandma",
      dollars: "2.50",
      say: "Send $2.50 to Grandma?",
    });
  });

  it("falls back to 'say' for an unknown contact, never inventing one", () => {
    const result = interpretWithRules("send $2 to Uncle Bob", baseContext);
    expect(result).toEqual({ kind: "say", text: "Uncle Bob isn't on your list yet." });
  });
});

describe("interpretWithRules — save", () => {
  it("matches a plain save amount", () => {
    expect(interpretWithRules("save $3", baseContext)).toEqual({
      kind: "propose_save",
      dollars: "3",
      say: "Put $3 in your jar?",
    });
  });

  it("matches 'put X dollars in my jar'", () => {
    expect(interpretWithRules("put 4 dollars in my jar", baseContext)).toEqual({
      kind: "propose_save",
      dollars: "4",
      say: "Put $4 in your jar?",
    });
  });
});

describe("interpretWithRules — blocked explanation", () => {
  it("uses the last blocked reason when present", () => {
    const context: OwlContext = { ...baseContext, lastBlockedReason: "That's over your daily limit." };
    expect(interpretWithRules("why didn't that work", context)).toEqual({
      kind: "explain_blocked",
      text: "That's over your daily limit.",
    });
  });

  it("falls back to a generic explanation when no reason is on file", () => {
    const result = interpretWithRules("why didn't it work", baseContext);
    expect(result.kind).toBe("explain_blocked");
  });
});

describe("interpretWithRules — fallback", () => {
  it("returns a gentle 'say' for anything unrecognised", () => {
    const result = interpretWithRules("tell me a joke", baseContext);
    expect(result.kind).toBe("say");
  });

  it("returns a gentle 'say' for empty input", () => {
    const result = interpretWithRules("   ", baseContext);
    expect(result.kind).toBe("say");
  });
});
