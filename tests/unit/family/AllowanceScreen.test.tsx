// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AllowanceScreenProps } from "@/components/family/contract";

const saveAllowance = vi.fn();
const payAllowanceNow = vi.fn();
const router = { refresh: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/family/allowance/actions", () => ({
  saveAllowance: (...a: unknown[]) => saveAllowance(...a),
  payAllowanceNow: (...a: unknown[]) => payAllowanceNow(...a),
  prepareKeeperRole: vi.fn(),
  submitKeeperRole: vi.fn(),
}));
vi.mock("@/lib/device/key", () => ({ getOrCreateDeviceKey: async () => ({ publicKey: "x", signTransaction: async () => "" }) }));

import { AllowanceScreen } from "@/components/family/AllowanceScreen";

const props: AllowanceScreenProps = {
  familyName: "Serawak",
  timezone: "Asia/Kuching",
  keeperEnabled: true,
  keeperWeeklyCap: { units: 200_000_000, display: "$200.00" },
  kids: [
    { id: "k1", name: "Mia", emoji: "🦦", age: 10, amount: { units: 10_000_000, display: "$10.00" }, isDefault: false, cadence: "weekly", nextRunISO: "2026-09-14T01:00:00Z", nextRunLabel: "Monday 14 Sept, 09:00", lastPaidLabel: null },
    { id: "k2", name: "Zoe", emoji: "🦦", age: 8, amount: { units: 8_000_000, display: "$8.00" }, isDefault: true, cadence: "weekly", nextRunISO: "2026-09-14T01:00:00Z", nextRunLabel: "Monday 14 Sept, 09:00", lastPaidLabel: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  saveAllowance.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("AllowanceScreen", () => {
  it("offers Pay now until an amount changes, then a Save button on that kid's card only", () => {
    const { container } = render(<AllowanceScreen {...props} />);
    expect(screen.getByRole("button", { name: "Pay $10.00 now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pay $8.00 now" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save allowance" })).toBeNull();
    fireEvent.change(container.querySelector("#allowance-k2")!, { target: { value: "5" } });
    expect(screen.getByRole("button", { name: "Save allowance" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pay $10.00 now" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pay $8.00 now" })).toBeNull();
    expect(screen.getByText("Save the new amount first.")).toBeTruthy();
  });

  it("saves that kid's new amount", async () => {
    const { container } = render(<AllowanceScreen {...props} />);
    fireEvent.change(container.querySelector("#allowance-k2")!, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save allowance" }));
    await waitFor(() => expect(saveAllowance).toHaveBeenCalledWith("k2", "5"));
    await waitFor(() => expect(screen.getByText("Zoe's allowance is saved.")).toBeTruthy());
    expect(router.refresh).toHaveBeenCalled();
  });

  it("never pins a control over the bottom navigation", () => {
    const { container } = render(<AllowanceScreen {...props} />);
    expect(container.querySelector(".fixed")).toBeNull();
  });
});
