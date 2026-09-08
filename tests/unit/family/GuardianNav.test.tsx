// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GuardianNav } from "@/components/family/GuardianNav";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

afterEach(cleanup);

describe("GuardianNav", () => {
  it("shows Home, Family and Goals, with the badge on Family", () => {
    usePathname.mockReturnValue("/family");
    render(<GuardianNav requestsBadge={<span>3 waiting</span>} />);

    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Goals" }).getAttribute("href")).toBe("/goals");
    const family = screen.getByRole("link", { name: /Family/ });
    expect(family.getAttribute("href")).toBe("/family");
    expect(family.getAttribute("aria-current")).toBe("page");
    expect(family.textContent).toContain("3 waiting");
  });

  it("opens More with Settings and Sign out only, and closes on Escape", () => {
    usePathname.mockReturnValue("/");
    render(<GuardianNav />);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("dialog", { name: "More" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/settings");
    expect(screen.queryByRole("link", { name: "Activity" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Rules" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "More" }).getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the sheet when the route changes", () => {
    usePathname.mockReturnValue("/");
    const { rerender } = render(<GuardianNav />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    usePathname.mockReturnValue("/settings");
    rerender(<GuardianNav />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
