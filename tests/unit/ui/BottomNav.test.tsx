// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BottomNav } from "@/components/ui/BottomNav";
import { GUARDIAN_DESTINATIONS } from "@/components/family/places";

const usePathname = vi.fn();

// vi.mock is hoisted above the imports above by Vitest's transform, so
// BottomNav picks up this mocked usePathname.
vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

// This project doesn't run Vitest with `globals: true`, so RTL's automatic
// afterEach cleanup (which looks for a global `afterEach`) never registers.
// Unmount explicitly between tests instead.
afterEach(() => {
  cleanup();
});

describe("BottomNav", () => {
  it("renders the guardian destinations with visible labels", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav destinations={GUARDIAN_DESTINATIONS} />);

    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Family" }).getAttribute("href")).toBe("/family");
    expect(screen.getByRole("link", { name: "Goals" }).getAttribute("href")).toBe("/goals");
    for (const name of ["Home", "Family", "Goals"]) expect(screen.getByText(name)).toBeTruthy();
  });

  it("marks the destination matching the current path, nested paths included", () => {
    usePathname.mockReturnValue("/family/kids/abc");
    render(<BottomNav destinations={GUARDIAN_DESTINATIONS} />);

    expect(screen.getByRole("link", { name: "Family" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Goals" }).getAttribute("aria-current")).toBeNull();
  });

  it("matches Home only on the root path", () => {
    usePathname.mockReturnValue("/family");
    render(<BottomNav destinations={GUARDIAN_DESTINATIONS} />);
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();

    cleanup();
    usePathname.mockReturnValue("/");
    render(<BottomNav destinations={GUARDIAN_DESTINATIONS} />);
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
  });

  it("selects nothing when the path matches no destination", () => {
    usePathname.mockReturnValue("/kit");
    render(<BottomNav destinations={GUARDIAN_DESTINATIONS} />);

    for (const name of ["Home", "Family", "Goals"]) {
      expect(screen.getByRole("link", { name }).getAttribute("aria-current")).toBeNull();
    }
  });

  it("renders a badge next to a destination's label", () => {
    usePathname.mockReturnValue("/");
    const withBadge = GUARDIAN_DESTINATIONS.map((d) => (d.label === "Family" ? { ...d, badge: <span>2 waiting</span> } : d));
    render(<BottomNav destinations={withBadge} />);

    expect(screen.getByRole("link", { name: /Family/ }).textContent).toContain("2 waiting");
  });

  it("adds a More button that calls onMore instead of navigating", () => {
    usePathname.mockReturnValue("/");
    const onMore = vi.fn();
    render(<BottomNav destinations={GUARDIAN_DESTINATIONS} onMore={onMore} moreOpen={false} />);

    const more = screen.getByRole("button", { name: "More" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(onMore).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "More" })).toBeNull();
  });

  it("has no More button without onMore", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav destinations={GUARDIAN_DESTINATIONS} />);
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });
});
