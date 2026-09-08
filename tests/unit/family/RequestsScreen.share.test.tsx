// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RequestsScreen } from "@/components/family/RequestsScreen";
import type { RequestsScreenProps } from "@/components/family/contract";

const decideRequest = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/family/requests/actions", () => ({ decideRequest: (...args: unknown[]) => decideRequest(...args) }));

afterEach(() => {
  cleanup();
  decideRequest.mockReset();
});

const money = (display: string) => ({ units: 0, display });
const props: RequestsScreenProps = {
  familyName: "Us",
  pending: [
    { id: "r1", type: "share", kidName: "Mia", kidEmoji: "🦦", contactLabel: "Grandma", amount: money("$2.00"), status: "pending", whenLabel: "Asked at 14:30" },
    { id: "r2", type: "approve_send", kidName: "Mia", kidEmoji: "🦦", contactLabel: "Sam", amount: money("$22.00"), status: "pending", whenLabel: "Asked at 14:31" },
  ],
  decided: [{ id: "r3", type: "share", kidName: "Mia", kidEmoji: "🦦", contactLabel: "Grandma", amount: money("$1.00"), status: "used", whenLabel: "Sent at 12:00" }],
};

describe("RequestsScreen with share requests", () => {
  it("says a share is from the share jar, with the same approve and decline", async () => {
    decideRequest.mockResolvedValue({ ok: true });
    render(<RequestsScreen {...props} />);
    expect(screen.getByText("Mia wants to share $2.00 with Grandma from their share jar")).toBeTruthy();
    expect(screen.getByText("Mia wants to send $22.00 to Sam")).toBeTruthy();
    expect(screen.getByText("Mia shared $1.00 with Grandma")).toBeTruthy();
    const approve = screen.getAllByRole("button", { name: "Approve" })[0];
    await act(async () => {
      fireEvent.click(approve);
    });
    expect(decideRequest).toHaveBeenCalledWith("r1", "approved");
    expect(screen.getByText("Mia can share $2.00 with Grandma today.")).toBeTruthy();
  });
});
