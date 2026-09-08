// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GoalsPageData } from "@/app/goals/actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const reopenGoal = vi.fn<(id: string) => Promise<{ ok: true }>>(async () => ({ ok: true }));
vi.mock("@/app/goals/actions", () => ({ createGoal: vi.fn(), reopenGoal: (id: string) => reopenGoal(id) }));
// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));

import { GoalsScreen } from "@/components/family/GoalsScreen";

const data: GoalsPageData = {
  kids: [{ id: "a", name: "Mia" }],
  wallet: { balance: { units: 100_000_000, display: "$100.00" }, setAside: { units: 40_000_000, display: "$40.00" }, free: { units: 60_000_000, display: "$60.00" } },
  goals: [
    {
      id: "g1",
      title: "Japan together",
      emoji: "✈️",
      kind: "trip",
      art: "/illustrations/japan-goal-vignette.png",
      ownerLabel: "Family goal",
      kidId: null,
      targetDisplay: "$6,000.00",
      savedDisplay: "$40.00",
      progress: { percent: 1, percentLabel: "1%", amountLabel: "$40.00 of $6,000.00" },
      targetDateLabel: "By 20 Dec 2026",
      participants: [{ name: "Mark", emoji: "🧑" }],
    },
  ],
  closedGoals: [{ id: "g0", title: "A bike for Mia", emoji: "🚲", ownerLabel: "Mia's goal", closedLabel: "Closed 8 Sep 2026" }],
  jarGoals: [{ kidId: "a", kidName: "Mia", kidEmoji: "🦦", savedDisplay: "$4.00", goal: { title: "A bike", emoji: "🚲", targetDisplay: "$20.00", progress: { percent: 20, percentLabel: "20%", amountLabel: "$4.00 of $20.00" } } }],
};

afterEach(cleanup);

describe("GoalsScreen", () => {
  it("leads with what is free, lists each goal as a link, and keeps the kids' jar goals below", () => {
    render(<GoalsScreen data={data} />);
    expect(screen.getByText("$60.00 free")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Japan together/ }).getAttribute("href")).toBe("/goals/g1");
    expect(screen.getByText("Family goal")).toBeTruthy();
    expect(screen.getByText("By 20 Dec 2026")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Jar goals" })).toBeTruthy();
    expect(screen.getByText("A bike")).toBeTruthy();
  });

  it("opens the new-goal form with the kinds and everyone-or-a-kid", () => {
    render(<GoalsScreen data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "New goal" }));
    expect(screen.getByLabelText("What are you saving for?")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /A trip/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Everyone" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Mia" })).toBeTruthy();
  });

  it("invites the first goal when there are none", () => {
    render(<GoalsScreen data={{ ...data, goals: [], closedGoals: [], jarGoals: [] }} />);
    expect(screen.getByRole("button", { name: "Start the first goal" })).toBeTruthy();
  });

  it("keeps closed goals in view, out of the way, with a way back", async () => {
    render(<GoalsScreen data={data} />);
    expect(screen.getByText("Closed goals")).toBeTruthy();
    expect(screen.getByText("A bike for Mia")).toBeTruthy();
    expect(screen.getByText(/Closed 8 Sep 2026/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /A bike for Mia/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(reopenGoal).toHaveBeenCalledWith("g0"));
  });

  it("says nothing about closed goals when there are none", () => {
    render(<GoalsScreen data={{ ...data, closedGoals: [] }} />);
    expect(screen.queryByText("Closed goals")).toBeNull();
  });
});
