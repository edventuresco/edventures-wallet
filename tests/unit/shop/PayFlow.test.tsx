// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PayFlow } from "@/components/wallet/PayFlow";
import type { PayShopDeps } from "@/components/kid/usePayShop";

// The real actions modules pull in Solana and Supabase; the flow only needs
// the four functions, which the test injects through deps.
vi.mock("@/app/pay/actions", () => ({ quoteShop: vi.fn(), prepareShopPayment: vi.fn(), submitShopPayment: vi.fn(), getShopPaymentStatus: vi.fn() }));
vi.mock("@/app/kid/pay/actions", () => ({ quoteShop: vi.fn(), prepareShopPayment: vi.fn(), submitShopPayment: vi.fn(), getShopPaymentStatus: vi.fn() }));
vi.mock("@/lib/device/key", () => ({ getOrCreateDeviceKey: vi.fn() }));
// No camera in jsdom: the scanner becomes a button that hands over a code.
vi.mock("@/components/kid/QrScanner", () => ({
  QrScanner: ({ onResult }: { onResult: (s: string) => void }) => (
    <button type="button" onClick={() => onResult("00020101021238VIETQR")}>
      Scan a code
    </button>
  ),
}));

afterEach(cleanup);

const READY_QUOTE = {
  ok: true as const,
  needsAmount: false as const,
  txId: "tx-1",
  merchant: "Pho 24",
  currency: "VND",
  country: "VN",
  amountLocal: 79_000,
  amountLocalDisplay: "79,000",
  amountUsdUnits: "3100000",
  feeUsdUnits: "100000",
  totalUsdUnits: "3200000",
  amountUsd: { units: 3_100_000, display: "$3.10" },
  feeUsd: { units: 100_000, display: "$0.10" },
  totalUsd: { units: 3_200_000, display: "$3.20" },
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
};

function deps(over: Partial<PayShopDeps> = {}): Partial<PayShopDeps> {
  return {
    quoteShop: vi.fn().mockResolvedValue(READY_QUOTE),
    prepareShopPayment: vi.fn().mockResolvedValue({ ok: true, token: "t", txBase64: "AA==", summary: "Pay 79,000 VND at Pho 24 · $3.20" }),
    submitShopPayment: vi.fn().mockResolvedValue({ ok: true, txId: "tx-1", explorerUrl: "https://explorer/tx/1" }),
    getShopPaymentStatus: vi.fn().mockResolvedValue({ ok: true, status: "success", message: "Paid. Pho 24 has your $3.20.", explorerUrl: "https://explorer/tx/1" }),
    getDeviceKey: vi.fn().mockResolvedValue({ publicKey: "pk", signTransaction: vi.fn().mockResolvedValue("signed") }),
    ...over,
  };
}

describe("PayFlow (a parent, from the family wallet)", () => {
  it("scans, quotes, pays and reports the shop paid, with no lesson gate", async () => {
    const d = deps();
    render(<PayFlow deps={d} pollIntervalMs={1} />);

    expect(screen.getByRole("heading", { level: 1, name: "Pay a shop" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Scan a code" }));
    await waitFor(() => expect(screen.getByText("Pho 24")).toBeTruthy());
    expect(screen.getByText("$3.20")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Pay" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Paid. Pho 24 has your $3.20."));
    expect(screen.getByText(/from the family wallet/)).toBeTruthy();
    expect(d.prepareShopPayment).toHaveBeenCalledWith({ txId: "tx-1" });
    expect(screen.getByRole("link", { name: "Back home" }).getAttribute("href")).toBe("/");
  });

  it("stops with the server's reason when the quote is refused", async () => {
    render(<PayFlow deps={deps({ quoteShop: vi.fn().mockResolvedValue({ ok: false, message: "That's $50.00, but your family wallet has $20.00." }) })} />);
    fireEvent.click(screen.getByRole("button", { name: "Scan a code" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("your family wallet has $20.00"));
    expect(screen.getByRole("button", { name: "Scan again" })).toBeTruthy();
  });
});
