// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SettingsState } from "@/app/settings/actions";

const actions = {
  getSettingsState: vi.fn(),
  getDeviceState: vi.fn(),
  renameFamily: vi.fn(),
  setGuardianLabel: vi.fn(),
  enablePayments: vi.fn(),
  setKidPayments: vi.fn(),
};
const createFamily = vi.fn();
const createWallet = vi.fn();
const registerDevice = vi.fn();

vi.mock("@/app/settings/actions", () => ({
  getSettingsState: (...a: unknown[]) => actions.getSettingsState(...a),
  getDeviceState: (...a: unknown[]) => actions.getDeviceState(...a),
  renameFamily: (...a: unknown[]) => actions.renameFamily(...a),
  setGuardianLabel: (...a: unknown[]) => actions.setGuardianLabel(...a),
  enablePayments: (...a: unknown[]) => actions.enablePayments(...a),
  setKidPayments: (...a: unknown[]) => actions.setKidPayments(...a),
}));
vi.mock("@/app/family/actions", () => ({ createFamily: (...a: unknown[]) => createFamily(...a) }));
vi.mock("@/app/wallet/actions", () => ({ createWallet: (...a: unknown[]) => createWallet(...a) }));
vi.mock("@/lib/device/actions", () => ({ registerDevice: (...a: unknown[]) => registerDevice(...a) }));
vi.mock("@/lib/device/key", () => ({ getOrCreateDeviceKey: async () => ({ publicKey: "DevicePubkey1111111111111111111111111111111", signTransaction: async () => "" }) }));
vi.mock("@/components/kid/Avatar", () => ({ Avatar: () => null }));

import { SettingsScreen } from "@/components/settings/SettingsScreen";

const base: SettingsState = { email: "parent@example.com", kind: "none", family: null, guardianLabel: null, kidName: null, hasWallet: false, payments: null };
const guardian: SettingsState = {
  ...base,
  kind: "guardian",
  family: { id: "f1", name: "The Tans" },
  guardianLabel: "Parent",
  hasWallet: true,
  payments: { customerIdMasked: null, kids: [{ id: "kid_1", name: "Alex", avatarId: "otter", shopPayEnabled: false }] },
};

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
  createFamily.mockReset();
  createWallet.mockReset();
  registerDevice.mockReset();
  actions.getDeviceState.mockResolvedValue({ registered: true, deviceId: "d1", onWallet: true });
});

afterEach(cleanup);

describe("SettingsScreen", () => {
  it("lets a signed-in user with no family set up the device, then start the family", async () => {
    actions.getSettingsState.mockResolvedValue({ ...base, hasWallet: true });
    createFamily.mockResolvedValue({ ok: true });
    render(<SettingsScreen initial={{ ...base, hasWallet: true }} />);

    expect(screen.getByText("No family yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open the invite email from a grown-up/ }).getAttribute("href")).toBe("/join");
    await screen.findByText("This device has its key");

    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "  The Tans " } });
    fireEvent.click(screen.getByRole("radio", { name: "Guardian" }));
    fireEvent.click(screen.getByRole("button", { name: "Start the family" }));

    await waitFor(() => expect(createFamily).toHaveBeenCalledWith({ name: "The Tans", label: "Guardian" }));
    await screen.findByText("Your family is ready.");
  });

  it("says so when the chain has no role for this key, even though the rows tick both steps", async () => {
    actions.getDeviceState.mockResolvedValue({ registered: true, deviceId: "d1", onWallet: false });
    actions.getSettingsState.mockResolvedValue(guardian);
    render(<SettingsScreen initial={guardian} />);

    await screen.findByText(/This key isn't on your wallet/);
    expect(screen.queryByRole("button", { name: "Create my wallet" })).toBeNull();
    expect(screen.getByText("Sign out").closest("form")?.getAttribute("onsubmit")).toBeNull();
  });

  it("keeps the notice away while Solana could not be read", async () => {
    actions.getDeviceState.mockResolvedValue({ registered: true, deviceId: "d1", onWallet: null });
    actions.getSettingsState.mockResolvedValue(guardian);
    render(<SettingsScreen initial={guardian} />);

    await screen.findByText("This device has its key");
    expect(screen.queryByText(/This key isn't on your wallet/)).toBeNull();
  });

  it("registers the device from the device section", async () => {
    actions.getDeviceState.mockResolvedValue({ registered: false, deviceId: null, onWallet: null });
    actions.getSettingsState.mockResolvedValue(base);
    registerDevice.mockResolvedValue({ ok: true, deviceId: "d1" });
    render(<SettingsScreen initial={base} />);

    fireEvent.click(await screen.findByRole("button", { name: "Set up this device" }));

    await waitFor(() => expect(registerDevice).toHaveBeenCalledWith("DevicePubkey1111111111111111111111111111111"));
    expect(screen.getByRole("button", { name: "Start the family" }).hasAttribute("disabled")).toBe(true);
  });

  it("walks a guardian through the KYC form with the test details and enables payments", async () => {
    actions.getSettingsState.mockResolvedValue(guardian);
    actions.enablePayments.mockResolvedValue({ ok: true, customerIdMasked: "mock…cdef" });
    render(<SettingsScreen initial={guardian} />);

    expect(screen.getByText("Role").nextElementSibling?.textContent).toBe("Parent");
    expect(screen.getByText("Not enabled")).toBeTruthy();
    expect(screen.getByText("Staging only.")).toBeTruthy();
    expect((screen.getByRole("switch", { name: "Pay a shop for Alex" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Set up payments" }));
    fireEvent.click(screen.getByRole("button", { name: "Enable payments" }));
    expect(screen.getByText("Enter their first and last name.")).toBeTruthy();
    expect(actions.enablePayments).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Fill in test details" }));
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Test Parent");
    fireEvent.click(screen.getByRole("button", { name: "Enable payments" }));

    await waitFor(() => expect(actions.enablePayments).toHaveBeenCalledTimes(1));
    expect(actions.enablePayments.mock.calls[0][0]).toMatchObject({ fullName: "Test Parent", phone: "+60100000000", email: "parent@example.com", idType: "NIC" });
    await screen.findByText(/Payments are on for this family/);
  });

  it("shows the masked customer and switches a kid on", async () => {
    const enabled: SettingsState = { ...guardian, payments: { customerIdMasked: "mock…cdef", kids: guardian.payments!.kids } };
    actions.getSettingsState.mockResolvedValue(enabled);
    actions.setKidPayments.mockResolvedValue({ ok: true });
    render(<SettingsScreen initial={enabled} />);

    expect(screen.getByText("Enabled for this family")).toBeTruthy();
    expect(screen.getByText(/Sqril customer mock…cdef/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Set up payments" })).toBeNull();

    fireEvent.click(screen.getByRole("switch", { name: "Pay a shop for Alex" }));

    await waitFor(() => expect(actions.setKidPayments).toHaveBeenCalledWith("kid_1", true));
    await screen.findByText("Alex can pay shops now.");
  });

  it("renames the family and changes the guardian label", async () => {
    actions.getSettingsState.mockResolvedValue(guardian);
    actions.renameFamily.mockResolvedValue({ ok: true });
    actions.setGuardianLabel.mockResolvedValue({ ok: true });
    render(<SettingsScreen initial={guardian} />);

    const rename = screen.getByRole("button", { name: "Rename" }) as HTMLButtonElement;
    expect(rename.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "The Lees" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(actions.renameFamily).toHaveBeenCalledWith("The Lees"));

    fireEvent.click(screen.getByRole("radio", { name: "Guardian" }));
    await waitFor(() => expect(actions.setGuardianLabel).toHaveBeenCalledWith("Guardian"));
  });

  it("shows a kid device its family and name, read-only, with no payments section", async () => {
    const kid: SettingsState = { ...base, email: null, kind: "kid", family: { id: "f1", name: "The Tans" }, kidName: "Alex" };
    actions.getSettingsState.mockResolvedValue(kid);
    render(<SettingsScreen initial={kid} />);

    expect(screen.getByText("Kid")).toBeTruthy();
    expect(screen.getByText("The Tans")).toBeTruthy();
    expect(screen.getByText("Alex")).toBeTruthy();
    expect(screen.queryByText("Payments")).toBeNull();
    expect(screen.queryByRole("button", { name: "Set up this device" })).toBeNull();
    await screen.findByText("Paired as Alex");
    expect(screen.getByRole("link", { name: "Back home" }).getAttribute("href")).toBe("/kid");
  });
});
