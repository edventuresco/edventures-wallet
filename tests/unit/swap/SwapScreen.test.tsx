// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SwapScreen, type SwapDeps } from "@/components/wallet/SwapScreen";

vi.mock("@/app/swap/actions", () => ({ getSwapState: vi.fn(), quoteSwap: vi.fn(), prepareSwap: vi.fn(), submitSwap: vi.fn() }));
vi.mock("@/lib/device/key", () => ({ getOrCreateDeviceKey: vi.fn() }));

afterEach(cleanup);

const state = { wallet: { address: "CSZV" }, usdc: { units: 24_500_000, display: "$24.50" }, solDisplay: "0.2000 SOL", solLamports: "200000000", provider: "devnet" as const };
const quote = { ok: true as const, direction: "usdc_to_sol" as const, inputDisplay: "$15.00", outputDisplay: "0.1000 SOL", rate: "1 SOL = $150.00", inputUnits: "15000000" };

function deps(over: Partial<SwapDeps> = {}): Partial<SwapDeps> {
  return {
    getSwapState: vi.fn().mockResolvedValue(state),
    quoteSwap: vi.fn().mockResolvedValue(quote),
    prepareSwap: vi.fn().mockResolvedValue({ ok: true, token: "t", txBase64: "AA==", summary: "Swap $15.00 for 0.1000 SOL", quote }),
    submitSwap: vi.fn().mockResolvedValue({ ok: true, signature: "sig", explorerUrl: "https://explorer/tx/sig" }),
    getDeviceKey: vi.fn().mockResolvedValue({ publicKey: "pk", signTransaction: vi.fn().mockResolvedValue("signed") }),
    ...over,
  };
}

describe("SwapScreen", () => {
  it("shows both balances, quotes an amount, then swaps through prepare, sign and submit", async () => {
    const d = deps();
    render(<SwapScreen deps={d} />);
    await waitFor(() => expect(screen.getByText("$24.50")).toBeTruthy());
    expect(screen.getByText("0.2000 SOL")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Amount in USDC"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Get a quote" }));
    await waitFor(() => expect(screen.getByText("0.1000 SOL")).toBeTruthy());
    expect(d.quoteSwap).toHaveBeenCalledWith({ direction: "usdc_to_sol", amount: "15" });

    fireEvent.click(screen.getByRole("button", { name: "Swap now" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Swap $15.00 for 0.1000 SOL. Done."));
    expect(d.prepareSwap).toHaveBeenCalledWith({ devicePubkey: "pk", direction: "usdc_to_sol", inputUnits: "15000000" });
    expect(d.submitSwap).toHaveBeenCalledWith({ token: "t", signedTxBase64: "signed", direction: "usdc_to_sol", inputUnits: "15000000" });
  });

  it("flips direction and shows the server's reason when a quote is refused", async () => {
    render(<SwapScreen deps={deps({ quoteSwap: vi.fn().mockResolvedValue({ ok: false, error: "You have 0.1950 SOL to swap." }) })} />);
    await waitFor(() => expect(screen.getByText("$24.50")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Swap direction/ }));
    expect(screen.getByRole("heading", { level: 2, name: "SOL to USDC" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Amount in SOL"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Get a quote" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("0.1950 SOL to swap"));
  });

  it("points at the wallet when there is none", async () => {
    render(<SwapScreen deps={deps({ getSwapState: vi.fn().mockResolvedValue({ ...state, wallet: null }) })} />);
    await waitFor(() => expect(screen.getByRole("link", { name: "Create my wallet" })).toBeTruthy());
  });
});
