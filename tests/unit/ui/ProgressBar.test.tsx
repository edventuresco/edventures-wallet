// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProgressBar } from "@/components/ui/ProgressBar";

// This project doesn't run Vitest with `globals: true`, so RTL's automatic
// afterEach cleanup (which looks for a global `afterEach`) never registers.
// Unmount explicitly between tests instead.
afterEach(() => {
  cleanup();
});

describe("ProgressBar", () => {
  it("renders the live text label", () => {
    render(<ProgressBar value={61} valueLabel="61%" />);
    expect(screen.getByText("61%")).toBeTruthy();
  });

  it("clamps a value above 100 down to 100", () => {
    render(<ProgressBar value={140} valueLabel="over" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
  });

  it("clamps a negative value up to 0", () => {
    render(<ProgressBar value={-20} valueLabel="under" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
  });

  it("always exposes the exact valueLabel as the accessible value text, regardless of clamping", () => {
    render(<ProgressBar value={999} valueLabel="$3,680 of $6,000" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuetext")).toBe("$3,680 of $6,000");
    expect(screen.getByText("$3,680 of $6,000")).toBeTruthy();
  });
});
