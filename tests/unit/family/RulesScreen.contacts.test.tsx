// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Keypair } from "@solana/web3.js";
import { RulesScreen } from "@/components/family/RulesScreen";
import type { RulesScreenProps } from "@/components/family/contract";

const addContact = vi.fn();
const removeContact = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/device/key", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/device/key")>()), getOrCreateDeviceKey: vi.fn() }));
vi.mock("@/app/family/rules/actions", () => ({
  addContact: (...args: unknown[]) => addContact(...args),
  removeContact: (...args: unknown[]) => removeContact(...args),
  saveRuleChanges: vi.fn(),
  prepareRuleSync: vi.fn(),
  submitRuleSync: vi.fn(),
}));

afterEach(() => {
  cleanup();
  addContact.mockReset();
  removeContact.mockReset();
  refresh.mockClear();
});

const money = (display: string) => ({ units: 0, display });
const props: RulesScreenProps = {
  familyName: "Us",
  timezone: "Asia/Kuching",
  members: [
    {
      kidId: "kid_1",
      kind: "kid",
      name: "Alex",
      emoji: "🦦",
      dailyLimit: money("$50.00"),
      weeklyLimit: money("$100.00"),
      approvalThreshold: money("$20.00"),
      pending: null,
      onchainSynced: true,
      hasDevice: false,
      contacts: [{ id: "c_1", label: "Grandma", emoji: "🧒", weeklyLimit: money("$20.00"), status: "active", onchainSynced: true }],
    },
  ],
};

const ADDRESS = Keypair.generate().publicKey.toBase58();

describe("RulesScreen contacts", () => {
  it("adds a person to a kid's list from a compact form", async () => {
    addContact.mockResolvedValue({ ok: true });
    render(<RulesScreen {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a person" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Uncle Bo" } });
    fireEvent.click(screen.getByRole("radio", { name: "Shop" }));
    fireEvent.change(screen.getByLabelText("Solana address"), { target: { value: ADDRESS } });
    const weekly = screen.getByLabelText(/Alex can send them in a week/) as HTMLInputElement;
    expect(weekly.value).toBe("50.00");
    fireEvent.change(weekly, { target: { value: "15" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to Alex's list" }));
    });
    expect(addContact).toHaveBeenCalledWith({ kidId: "kid_1", label: "Uncle Bo", avatarId: "shop", address: ADDRESS, weeklyDollars: "15" });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server's reason when adding fails", async () => {
    addContact.mockResolvedValue({ ok: false, error: "That address is already on Alex's list." });
    render(<RulesScreen {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a person" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Uncle Bo" } });
    fireEvent.change(screen.getByLabelText("Solana address"), { target: { value: ADDRESS } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to Alex's list" }));
    });
    expect(screen.getByText("That address is already on Alex's list.")).toBeTruthy();
  });

  it("removes a person with a quiet button", async () => {
    removeContact.mockResolvedValue({ ok: true });
    render(<RulesScreen {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Grandma" }));
    });
    expect(removeContact).toHaveBeenCalledWith("c_1");
    expect(refresh).toHaveBeenCalled();
  });
});
