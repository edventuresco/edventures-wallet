// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OnboardingState } from "@/app/onboarding/actions";

const setDisplayName = vi.fn();
const getDeviceState = vi.fn();
const createFamily = vi.fn();
const createWallet = vi.fn();
const registerDevice = vi.fn();
const router = { push: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/onboarding/actions", () => ({ setDisplayName: (...a: unknown[]) => setDisplayName(...a) }));
vi.mock("@/app/settings/actions", () => ({ getDeviceState: (...a: unknown[]) => getDeviceState(...a) }));
vi.mock("@/app/family/actions", () => ({ createFamily: (...a: unknown[]) => createFamily(...a) }));
vi.mock("@/app/wallet/actions", () => ({ createWallet: (...a: unknown[]) => createWallet(...a) }));
vi.mock("@/lib/device/actions", () => ({ registerDevice: (...a: unknown[]) => registerDevice(...a) }));
vi.mock("@/lib/device/key", () => ({ getOrCreateDeviceKey: async () => ({ publicKey: "DevicePubkey1111111111111111111111111111111", signTransaction: async () => "" }) }));

import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";

const fresh: OnboardingState = { email: "parent@example.com", name: null, hasWallet: false };

beforeEach(() => {
  vi.clearAllMocks();
  getDeviceState.mockResolvedValue({ registered: true, deviceId: "d1" });
  setDisplayName.mockResolvedValue({ ok: true });
  createFamily.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("OnboardingScreen", () => {
  it("asks for a name first and keeps the family step locked", async () => {
    render(<OnboardingScreen initial={fresh} />);
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Start the family" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("What should we call you?"), { target: { value: "  Mark " } });
    fireEvent.click(screen.getByRole("button", { name: "That's me" }));
    await waitFor(() => expect(setDisplayName).toHaveBeenCalledWith("Mark"));
    await waitFor(() => expect(screen.getByText("We'll call you Mark")).toBeTruthy());
  });

  it("starts the family once name, device and wallet are ready, then goes home", async () => {
    render(<OnboardingScreen initial={{ ...fresh, name: "Mark", hasWallet: true }} />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Start the family" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "The Tans" } });
    fireEvent.click(screen.getByRole("button", { name: "Start the family" }));
    await waitFor(() => expect(createFamily).toHaveBeenCalledWith({ name: "The Tans", label: "Parent" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
  });
});
