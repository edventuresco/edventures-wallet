import { describe, expect, it } from "vitest";
import { feedItemFrom, feedTone, feedWhenLabel, type FeedEventRow } from "@/lib/family/feed";

const TZ = "Asia/Kuching"; // UTC+8
const NOW = new Date("2026-09-10T07:57:00Z"); // Thursday 15:57 local
const kids = [{ id: "kid_1", name: "Mia", avatar_id: "otter", birth_month: null, birth_year: null }];

const row = (over: Partial<FeedEventRow> = {}): FeedEventRow => ({
  id: "e1",
  kid_id: "kid_1",
  kind: "sent",
  summary: "Sent $2.00 to Sam",
  signature: null,
  created_at: "2026-09-10T07:57:00Z",
  ...over,
});

describe("feedWhenLabel", () => {
  it("says Today and Yesterday with the clock, and the date beyond that", () => {
    expect(feedWhenLabel(new Date("2026-09-10T07:57:00Z"), NOW, TZ)).toBe("Today, 15:57");
    expect(feedWhenLabel(new Date("2026-09-09T01:00:00Z"), NOW, TZ)).toBe("Yesterday, 09:00");
    // ICU spells September "Sep" or "Sept" depending on the Node build.
    expect(feedWhenLabel(new Date("2026-09-07T01:00:00Z"), NOW, TZ)).toMatch(/^Monday 7 Sept?, 09:00$/);
  });
});

describe("feedTone", () => {
  it("marks stops, money arriving for the kid, and everything else", () => {
    expect(feedTone("blocked")).toBe("blocked");
    expect(feedTone("shop_failed")).toBe("blocked");
    expect(feedTone("allowance")).toBe("allowance");
    expect(feedTone("split")).toBe("allowance");
    expect(feedTone("sent")).toBe("plain");
    expect(feedTone("anything_else")).toBe("plain");
  });
});

describe("feedItemFrom", () => {
  it("pairs the kid's face with the sentence, the time, and a proof link when there is a signature", () => {
    expect(feedItemFrom(row({ signature: "5abc" }), kids, NOW, TZ)).toEqual({
      id: "e1",
      kidName: "Mia",
      kidEmoji: "🦦",
      summary: "Sent $2.00 to Sam",
      whenLabel: "Today, 15:57",
      tone: "plain",
      proofUrl: expect.stringContaining("5abc"),
    });
  });

  it("has no proof link without a signature, and a family face for family-level events", () => {
    const item = feedItemFrom(row({ kid_id: null, kind: "funded", summary: "The family wallet got $100.00" }), kids, NOW, TZ);
    expect(item.proofUrl).toBeUndefined();
    expect(item.kidName).toBe("Family");
    expect(item.kidEmoji).toBe("🏡");
  });

  it("falls back to a plain face for a kid it does not know", () => {
    expect(feedItemFrom(row({ kid_id: "kid_9" }), kids, NOW, TZ).kidName).toBe("A kid");
  });
});

describe("feedItemFrom for the grown-up's own rows", () => {
  it("wears the owner's name when given, and Family otherwise", () => {
    const own = row({ kid_id: null, summary: "You sent $5.00" });
    expect(feedItemFrom(own, kids, NOW, TZ, { ownerName: "Mark" })).toMatchObject({ kidName: "Mark", kidEmoji: "🧑" });
    expect(feedItemFrom(own, kids, NOW, TZ)).toMatchObject({ kidName: "Family", kidEmoji: "🏡" });
  });
});
