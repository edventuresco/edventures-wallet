// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GoalDetail } from "@/app/goals/actions";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const archiveGoal = vi.fn<(id: string) => Promise<{ ok: true }>>(async () => ({ ok: true }));
vi.mock("@/app/goals/actions", () => ({ archiveGoal: (id: string) => archiveGoal(id), releaseContribution: vi.fn(), setAside: vi.fn(), updateGoal: vi.fn() }));
// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));

import { GoalDetailScreen } from "@/components/family/GoalDetailScreen";

const goal: GoalDetail = {
  id: "g1",
  title: "Japan",
  emoji: "✈️",
  kind: "trip",
  art: null,
  ownerLabel: "Family goal",
  kidId: null,
  targetDisplay: "$3,000.00",
  savedDisplay: "$40.00",
  progress: { percent: 1, percentLabel: "1%", amountLabel: "$40.00 of $3,000.00" },
  targetDateLabel: "By 30 Sep 2026",
  targetDate: "2026-09-30",
  blurb: "Experiences build a richer kind of wealth.",
  participants: [{ name: "Mark", emoji: "🧑" }],
  contributors: [{ key: "user:u1", name: "Mark", display: "$40.00", percent: 100, percentLabel: "100%" }],
  contributions: [{ id: "c1", name: "Mark", display: "$40.00", whenLabel: "Today", released: false }],
  free: { units: 60_000_000, display: "$60.00" },
  kids: [],
};

afterEach(() => {
  cleanup();
  archiveGoal.mockClear();
  push.mockClear();
});

describe("GoalDetailScreen: stopping a goal", () => {
  it("does not close the goal on the first tap; it asks first and says what happens to the money", () => {
    render(<GoalDetailScreen goal={goal} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop saving for this goal" }));
    expect(archiveGoal).not.toHaveBeenCalled();
    expect(screen.getByText(/Stop saving for Japan\?/)).toBeTruthy();
    expect(screen.getByText(/\$40\.00 .*goes back to what is free/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep saving" })).toBeTruthy();
  });

  it("keeps the goal when the guardian changes their mind", () => {
    render(<GoalDetailScreen goal={goal} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop saving for this goal" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep saving" }));
    expect(archiveGoal).not.toHaveBeenCalled();
    expect(screen.queryByText(/Stop saving for Japan\?/)).toBeNull();
    expect(screen.getByRole("button", { name: "Stop saving for this goal" })).toBeTruthy();
  });

  it("closes the goal only on the confirming tap, then goes back to the list", async () => {
    render(<GoalDetailScreen goal={goal} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop saving for this goal" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, stop saving" }));
    await waitFor(() => expect(archiveGoal).toHaveBeenCalledWith("g1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/goals"));
  });
});
