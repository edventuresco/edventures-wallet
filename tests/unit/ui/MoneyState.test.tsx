// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MoneyState, type MoneyMovingStatus } from "@/components/ui/MoneyState";

// This project doesn't run Vitest with `globals: true`, so RTL's automatic
// afterEach cleanup (which looks for a global `afterEach`) never registers.
// Unmount explicitly between tests instead.
afterEach(() => {
  cleanup();
});

const STATES: MoneyMovingStatus[] = [
  "idle",
  "pressed",
  "loading",
  "success",
  "needs_approval",
  "scheduled",
  "failed_recoverable",
  "blocked_by_rule",
];

describe("MoneyState", () => {
  it.each(STATES)("renders the exact copy passed in for status %s", (status) => {
    const message = `copy for ${status}`;
    render(<MoneyState status={status} message={message} />);
    expect(screen.getByText(message)).toBeTruthy();
  });

  it("never falls back to a generic error message", () => {
    render(<MoneyState status="failed_recoverable" message="The transfer to Grandma didn't complete." />);
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  it("shows the reference line only for success", () => {
    render(<MoneyState status="success" message="Added." reference="Ref #A93F" />);
    expect(screen.getByText("Ref #A93F")).toBeTruthy();
  });

  it("omits the reference line when the status is not success", () => {
    render(<MoneyState status="loading" message="Adding to Japan together…" reference="Ref #A93F" />);
    expect(screen.queryByText("Ref #A93F")).toBeNull();
  });

  it("wires the retry action for failed_recoverable", () => {
    const onRetry = vi.fn();
    render(
      <MoneyState
        status="failed_recoverable"
        message="That didn't go through."
        retryLabel="Try again"
        onRetry={onRetry}
      />,
    );
    screen.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not render a retry button for other statuses even if retryLabel is passed", () => {
    render(<MoneyState status="success" message="Added." retryLabel="Try again" />);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
