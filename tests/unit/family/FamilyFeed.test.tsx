// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FamilyFeed } from "@/components/family/FamilyFeed";
import type { FeedItem } from "@/lib/family/feed";

afterEach(cleanup);

const items: FeedItem[] = [
  { id: "e1", kidName: "Mia", kidEmoji: "🦦", summary: "Sent $2.00 to Sam", whenLabel: "Today, 15:57", tone: "plain", proofUrl: "https://explorer.solana.com/tx/5abc?cluster=devnet" },
  { id: "e2", kidName: "Mia", kidEmoji: "🦦", summary: "That's more than you can send today.", whenLabel: "Today, 15:50", tone: "blocked" },
  { id: "e3", kidName: "Mia", kidEmoji: "🦦", summary: "Allowance of $8.00 landed", whenLabel: "Monday 7 Sep, 09:00", tone: "allowance" },
];

describe("FamilyFeed", () => {
  it("lists events newest first with a proof link only where there is a signature", () => {
    render(<FamilyFeed items={items} seeAllHref="/family/activity" />);
    expect(screen.getByText("Sent $2.00 to Sam")).toBeTruthy();
    expect(screen.getByText("Today, 15:57")).toBeTruthy();
    const proofs = screen.getAllByRole("link", { name: /Proof/ });
    expect(proofs).toHaveLength(1);
    expect(proofs[0].getAttribute("href")).toContain("5abc");
    expect(screen.getByRole("link", { name: "See all" }).getAttribute("href")).toBe("/family/activity");
  });

  it("says so when nothing has happened yet", () => {
    render(<FamilyFeed items={[]} />);
    expect(screen.getByText(/Nothing yet/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "See all" })).toBeNull();
  });
});
