// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HomeScreen } from "@/components/home/HomeScreen";
import type { HomeState } from "@/app/home-actions";

// The test-dollars button refreshes the page through the app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

const state: HomeState = {
  ownerName: "Mark",
  balance: { units: 24_500_000, display: "$24.50" },
  familyName: "Our family",
  transactions: [{ id: "e1", kidName: "Mark", kidEmoji: "🧑", summary: "You sent $5.00", whenLabel: "Today, 15:57", tone: "plain" }],
  canAddTestDollars: true,
};

describe("HomeScreen", () => {
  it("shows the owner's name, their balance and the four actions", () => {
    render(<HomeScreen state={state} />);

    expect(screen.getByRole("heading", { level: 1, name: "Mark's personal wallet" })).toBeTruthy();
    expect(screen.getByText("$24.50")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Receive" }).getAttribute("href")).toBe("/receive");
    expect(screen.getByRole("link", { name: "Send" }).getAttribute("href")).toBe("/wallet");
    expect(screen.getByRole("link", { name: "Pay" }).getAttribute("href")).toBe("/pay");
    expect(screen.getByRole("link", { name: "Swap" }).getAttribute("href")).toBe("/swap");
    expect(screen.getByText("You sent $5.00")).toBeTruthy();
  });

  it("offers test dollars under the balance on devnet, and not otherwise", () => {
    render(<HomeScreen state={state} />);
    expect(screen.getByRole("button", { name: "Add $25 of test dollars" })).toBeTruthy();
    cleanup();
    render(<HomeScreen state={{ ...state, canAddTestDollars: false }} />);
    expect(screen.queryByRole("button", { name: "Add $25 of test dollars" })).toBeNull();
  });

  it("offers to create a wallet when there is none", () => {
    render(<HomeScreen state={{ ...state, balance: null, familyName: null, transactions: [] }} />);
    expect(screen.getByRole("link", { name: "Create one" }).getAttribute("href")).toBe("/wallet");
  });
});
