// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WaitlistRow } from "@/app/admin/actions";

const getWaitlist = vi.fn();
const setWaitlistStatus = vi.fn();
vi.mock("@/app/admin/actions", () => ({
  getWaitlist: (...a: unknown[]) => getWaitlist(...a),
  setWaitlistStatus: (...a: unknown[]) => setWaitlistStatus(...a),
}));

import { WaitlistAdmin } from "@/components/admin/WaitlistAdmin";

const rows: WaitlistRow[] = [
  { id: "w1", email: "parent@example.com", country: "MY", kids: 2, status: "waiting", createdAt: "2026-09-07T10:00:00Z", statusChangedAt: null },
  { id: "w2", email: "other@example.com", country: null, kids: null, status: "accepted", createdAt: "2026-09-06T10:00:00Z", statusChangedAt: "2026-09-07T12:00:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  setWaitlistStatus.mockResolvedValue({ ok: true });
  getWaitlist.mockResolvedValue(rows.map((r) => (r.id === "w1" ? { ...r, status: "accepted" } : r)));
});
afterEach(cleanup);

describe("WaitlistAdmin", () => {
  it("lists everyone with a status and the counts", () => {
    render(<WaitlistAdmin initial={rows} />);
    expect(screen.getByText("parent@example.com")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Waiting (1)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Accepted (1)" })).toBeTruthy();
  });

  it("accepts a waiting email and reloads the list", async () => {
    render(<WaitlistAdmin initial={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(setWaitlistStatus).toHaveBeenCalledWith("w1", "accepted"));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Accepted (2)" })).toBeTruthy());
  });

  it("filters by status", () => {
    render(<WaitlistAdmin initial={rows} />);
    fireEvent.click(screen.getByRole("tab", { name: "Accepted (1)" }));
    expect(screen.queryByText("parent@example.com")).toBeNull();
    expect(screen.getByText("other@example.com")).toBeTruthy();
  });
});
