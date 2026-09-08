// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/app/waitlist/actions", () => ({ joinWaitlist: vi.fn() }));
// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));

import { LandingPage } from "@/components/marketing/LandingPage";
import { LANDING } from "@/lib/marketing/copy";

afterEach(cleanup);

describe("LandingPage", () => {
  it("says the tagline, headline and subhead from lib/marketing/copy, the same words the share card and Open Graph tags use", () => {
    render(<LandingPage />);
    expect(LANDING.tagline).toBe("Digital money. Family rules.");
    expect(screen.getAllByText(LANDING.tagline).length).toBeGreaterThanOrEqual(2); // the kicker and the footer
    expect(screen.getByRole("heading", { level: 1, name: LANDING.headline })).toBeTruthy();
    expect(screen.getByText(LANDING.subhead)).toBeTruthy();
  });

  it("leads with the headline and one primary action: the waitlist", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Grow money confidence together." })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Join the waitlist" }).getAttribute("href")).toBe("#waitlist");
    expect(screen.getByRole("heading", { level: 2, name: "Join the waitlist" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join the waitlist" })).toBeTruthy();
  });

  it("points the secondary action at edventures.co and keeps sign-in for beta members", () => {
    render(<LandingPage />);
    const explore = screen.getAllByRole("link", { name: "Explore Edventures" });
    expect(explore.length).toBeGreaterThan(0);
    explore.forEach((a) => expect(a.getAttribute("href")).toBe("https://edventures.co/"));
    screen.getAllByRole("link", { name: "Sign in" }).forEach((a) => expect(a.getAttribute("href")).toBe("/login"));
  });

  it("never mentions the $1 reservation from the old brief", () => {
    render(<LandingPage />);
    expect(screen.queryByText(/\$1/)).toBeNull();
  });
});
