// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GoalScreen } from "@/components/kid/GoalScreen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

describe("GoalScreen", () => {
  it("shows progress toward the goal from the save jar", () => {
    render(<GoalScreen saveDisplay="$12.00" saveUnits="12000000" goal={{ title: "Headphones", emoji: "🎧", targetUnits: "40000000" }} onSave={vi.fn()} />);
    expect(screen.getByText("Headphones")).toBeTruthy();
    expect(screen.getByText("$12.00 of $40.00")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("30");
  });

  it("invites the kid to pick a goal when there is none, and saves it", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<GoalScreen saveDisplay="$0.00" saveUnits="0" goal={null} onSave={onSave} />);
    expect(screen.getByText("What are you saving for?")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Goal name"), { target: { value: "Bike" } });
    fireEvent.click(screen.getByRole("radio", { name: "🚲" }));
    fireEvent.change(screen.getByLabelText("How much?"), { target: { value: "80" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save my goal" }));
    });
    expect(onSave).toHaveBeenCalledWith({ title: "Bike", emoji: "🚲", dollars: "80" });
    expect(refresh).toHaveBeenCalled();
  });

  it("lets the kid change an existing goal", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<GoalScreen saveDisplay="$12.00" saveUnits="12000000" goal={{ title: "Headphones", emoji: "🎧", targetUnits: "40000000" }} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Change my goal" }));
    expect((screen.getByLabelText("Goal name") as HTMLInputElement).value).toBe("Headphones");
    expect((screen.getByLabelText("How much?") as HTMLInputElement).value).toBe("40.00");
  });

  it("shows the reason when a save is refused", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: "Give your goal a name." });
    render(<GoalScreen saveDisplay="$0.00" saveUnits="0" goal={null} onSave={onSave} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save my goal" }));
    });
    expect(screen.getByText("Give your goal a name.")).toBeTruthy();
  });

  const withGoal = { saveDisplay: "$12.00", saveUnits: "12000000", spendDisplay: "$7.50", spendUnits: "7500000", goal: { title: "Headphones", emoji: "🎧", targetUnits: "40000000" } };

  function tap(name: string | RegExp) {
    fireEvent.click(screen.getByRole("button", { name }));
  }

  it("adds to the goal from the spend jar with the number pad", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(<GoalScreen {...withGoal} onSave={vi.fn()} onMove={onMove} />);
    tap("Add to goal");
    expect(screen.getByText("You have $7.50 to spend")).toBeTruthy();
    tap("$2");
    await act(async () => {
      tap("Next");
    });
    expect(onMove).toHaveBeenCalledWith("spend", "save", "2.00");
    expect(screen.getByText("Put $2.00 in your jar.")).toBeTruthy();
    tap("Back to my jar");
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText("Headphones")).toBeTruthy();
  });

  it("takes money back out of the jar, capped at what the jar holds", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(<GoalScreen {...withGoal} onSave={vi.fn()} onMove={onMove} />);
    tap("Take back");
    expect(screen.getByText("Your jar has $12.00")).toBeTruthy();
    tap("1");
    tap("5");
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    tap("Delete");
    await act(async () => {
      tap("Next");
    });
    expect(onMove).toHaveBeenCalledWith("save", "spend", "1.00");
    expect(screen.getByText("Took $1.00 back from your jar.")).toBeTruthy();
  });

  it("shows a warm stop when the move is refused", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: false, message: "You've done a lot today. More tomorrow." });
    render(<GoalScreen {...withGoal} onSave={vi.fn()} onMove={onMove} />);
    tap("Add to goal");
    tap("$1");
    await act(async () => {
      tap("Next");
    });
    expect(screen.getByText("You've done a lot today. More tomorrow.")).toBeTruthy();
    tap("Okay");
    expect(screen.getByText("Headphones")).toBeTruthy();
  });

  it("hides the jar moves until a move handler is wired", () => {
    render(<GoalScreen {...withGoal} onSave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Add to goal" })).toBeNull();
  });
});
