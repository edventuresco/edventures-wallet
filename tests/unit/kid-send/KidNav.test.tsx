// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { KidNav } from "@/components/kid/KidNav";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

afterEach(cleanup);

describe("KidNav", () => {
  it("offers Home, Goal, Learn and Pay with visible labels", () => {
    usePathname.mockReturnValue("/kid");
    render(<KidNav />);
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/kid");
    expect(screen.getByRole("link", { name: "Goal" }).getAttribute("href")).toBe("/kid/goal");
    expect(screen.getByRole("link", { name: "Learn" }).getAttribute("href")).toBe("/learn");
    expect(screen.getByRole("link", { name: "Pay" }).getAttribute("href")).toBe("/kid/pay");
  });

  it("marks only the current destination, and Home only on the exact kid route", () => {
    usePathname.mockReturnValue("/kid/goal");
    render(<KidNav />);
    expect(screen.getByRole("link", { name: "Goal" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
  });

  it("selects Learn inside a lesson", () => {
    usePathname.mockReturnValue("/learn/before-you-send");
    render(<KidNav />);
    expect(screen.getByRole("link", { name: "Learn" }).getAttribute("aria-current")).toBe("page");
  });
});
