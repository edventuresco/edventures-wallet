// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PayShopFlow, SHOP_LESSON_ID } from "@/components/kid/PayShopFlow";
import type { PayShopDeps } from "@/components/kid/usePayShop";

// The real actions module pulls in Solana and Supabase; the flow only needs
// its four functions, which the test injects through deps.
vi.mock("@/app/kid/pay/actions", () => ({
  quoteShop: vi.fn(),
  prepareShopPayment: vi.fn(),
  submitShopPayment: vi.fn(),
  getShopPaymentStatus: vi.fn(),
}));
vi.mock("@/lib/device/key", () => ({ getOrCreateDeviceKey: vi.fn() }));

// Lesson completion lives in localStorage, which this jsdom does not provide;
// the gate only asks one question, so answer it directly.
const lesson = vi.hoisted(() => ({ done: false }));
vi.mock("@/lib/lessons/storage", () => ({ isLessonComplete: (id: string) => id === "before-you-send" && lesson.done }));
function markLessonComplete() {
  lesson.done = true;
}

afterEach(cleanup);
beforeEach(() => {
  lesson.done = false;
});

const READY_QUOTE = {
  ok: true as const,
  needsAmount: false as const,
  txId: "tx-dyn",
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
  expiresAt: "2026-09-07T10:30:00.000Z",
};

function deps(overrides: Partial<PayShopDeps> = {}): PayShopDeps {
  return {
    quoteShop: vi.fn().mockResolvedValue(READY_QUOTE),
    prepareShopPayment: vi.fn().mockResolvedValue({ ok: true, token: "tok", txBase64: "AA==", summary: "Pay 79,000 VND at Pho 24 · $3.20" }),
    submitShopPayment: vi.fn().mockResolvedValue({ ok: true, txId: "tx-dyn", explorerUrl: "https://explorer.test/tx/sig" }),
    getShopPaymentStatus: vi.fn().mockResolvedValue({ ok: true, status: "success", message: "Paid. Pho 24 has your $3.20.", explorerUrl: "https://explorer.test/tx/sig" }),
    getDeviceKey: vi.fn().mockResolvedValue({ publicKey: "kid", signTransaction: vi.fn().mockResolvedValue("signed") }),
    ...overrides,
  };
}

/** jsdom has no camera, so the scanner offers "type it instead"; we type the code. */
async function scan(code: string) {
  const box = await screen.findByPlaceholderText("Paste or type the code's text");
  fireEvent.change(box, { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Use this code" }));
}

function renderFlow(d: PayShopDeps) {
  markLessonComplete();
  return render(<PayShopFlow deps={d} pollIntervalMs={1} pollTimeoutMs={50} />);
}

describe("PayShopFlow", () => {
  it("asks for the lesson first and only lets the kid through once it is really done", async () => {
    render(<PayShopFlow deps={deps()} />);
    expect(await screen.findByText("Before your first shop payment, do the 3-minute lesson.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Do the lesson" }).getAttribute("href")).toBe(`/learn/${SHOP_LESSON_ID}`);

    fireEvent.click(screen.getByRole("button", { name: "I've done it" }));
    expect(screen.getByText(/We can't see that lesson finished yet/)).toBeTruthy();

    markLessonComplete();
    fireEvent.click(screen.getByRole("button", { name: "I've done it" }));
    expect(await screen.findByText("Pay a shop")).toBeTruthy();
  });

  it("scan → quote → pay → signs on the device → polls to paid", async () => {
    const d = deps();
    renderFlow(d);
    await scan("dynamic-code");

    expect(d.quoteShop).toHaveBeenCalledWith({ qrString: "dynamic-code" });
    expect(await screen.findByText("79,000")).toBeTruthy();
    expect(screen.getByText("$3.20")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pay" }));
    });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Paid. Pho 24 has your $3.20."));

    expect(d.prepareShopPayment).toHaveBeenCalledWith({ txId: "tx-dyn" });
    expect(d.submitShopPayment).toHaveBeenCalledWith({ txId: "tx-dyn", token: "tok", signedTxBase64: "signed" });
    expect(d.getShopPaymentStatus).toHaveBeenCalledWith("tx-dyn");
    expect(screen.getByRole("link", { name: "Back home" }).getAttribute("href")).toBe("/kid");
    expect(screen.getByRole("link", { name: /Proof for grown-ups/ }).getAttribute("href")).toBe("https://explorer.test/tx/sig");
  });

  it("asks for an amount on a static code, then quotes again with it", async () => {
    const quoteShop = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, needsAmount: true, txId: "tx-static", merchant: "Kohi", currency: "VND", country: "VN" })
      .mockResolvedValueOnce({ ...READY_QUOTE, txId: "tx-static", merchant: "Kohi", amountLocal: 50_000, amountLocalDisplay: "50,000" });
    renderFlow(deps({ quoteShop }));
    await scan("static-code");

    expect(await screen.findByText("How much are you paying?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "0" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    });

    expect(quoteShop).toHaveBeenLastCalledWith({ qrString: "static-code", amountLocal: 50_000 });
    expect(await screen.findByText("50,000")).toBeTruthy();
  });

  it("shows the server's exact words when the quote is refused, with a way to scan again", async () => {
    renderFlow(deps({ quoteShop: vi.fn().mockResolvedValue({ ok: false, message: "That's more than you can spend today. You have $2.00 left." }) }));
    await scan("any");

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "That's more than you can spend today. You have $2.00 left.");
    fireEvent.click(screen.getByRole("button", { name: "Scan again" }));
    expect(await screen.findByText("Point at the shop's code")).toBeTruthy();
  });

  it("offers a different amount when a static code's quote is refused", async () => {
    const quoteShop = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, needsAmount: true, txId: "tx-static", merchant: "Kohi", currency: "VND", country: "VN" })
      .mockResolvedValueOnce({ ok: false, message: "That amount is outside what this shop can take." });
    renderFlow(deps({ quoteShop }));
    await scan("static-code");
    fireEvent.click(await screen.findByRole("button", { name: "9" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    });

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "That amount is outside what this shop can take.");
    fireEvent.click(screen.getByRole("button", { name: "Try a different amount" }));
    expect(await screen.findByText("How much are you paying?")).toBeTruthy();
  });

  it("keeps 'Try again' when the transfer was dropped, and pays the same quote again", async () => {
    const submitShopPayment = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: "That didn't go through, and nothing was paid. Try again in a moment.", retryable: true })
      .mockResolvedValueOnce({ ok: true, txId: "tx-dyn", explorerUrl: null });
    const d = deps({ submitShopPayment });
    renderFlow(d);
    await scan("dynamic-code");
    const pay = await screen.findByRole("button", { name: "Pay" });
    await act(async () => {
      fireEvent.click(pay);
    });

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "That didn't go through, and nothing was paid. Try again in a moment.");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Paid. Pho 24 has your $3.20."));
    expect(d.prepareShopPayment).toHaveBeenCalledTimes(2);
  });

  it("stops with a fresh scan when a rule said no", async () => {
    renderFlow(deps({ prepareShopPayment: vi.fn().mockResolvedValue({ ok: false, message: "You've done a lot today. More tomorrow." }) }));
    await scan("dynamic-code");
    const pay = await screen.findByRole("button", { name: "Pay" });
    await act(async () => {
      fireEvent.click(pay);
    });

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "You've done a lot today. More tomorrow.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Scan again" })).toBeTruthy();
  });

  it("tells the kid where the money is when the shop reports a failure", async () => {
    const getShopPaymentStatus = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: "processing", message: "Pho 24 is checking the payment. This usually takes a few seconds.", explorerUrl: null })
      .mockResolvedValueOnce({ ok: true, status: "failed", message: "Pho 24 didn't get paid. Your $3.20 is in the family wallet for now, and a parent can move it back.", explorerUrl: null });
    renderFlow(deps({ getShopPaymentStatus }));
    await scan("dynamic-code");
    const pay = await screen.findByRole("button", { name: "Pay" });
    await act(async () => {
      fireEvent.click(pay);
    });

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Pho 24 didn't get paid. Your $3.20 is in the family wallet for now, and a parent can move it back.");
    expect(getShopPaymentStatus).toHaveBeenCalledTimes(2);
  });

  it("says the payment is still on its way when the shop is slow", async () => {
    const getShopPaymentStatus = vi.fn().mockResolvedValue({ ok: true, status: "processing", message: "Pho 24 is checking the payment.", explorerUrl: null });
    renderFlow(deps({ getShopPaymentStatus }));
    await scan("dynamic-code");
    const pay = await screen.findByRole("button", { name: "Pay" });
    await act(async () => {
      fireEvent.click(pay);
    });

    expect(await screen.findByText("Still going", {}, { timeout: 2_000 })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/still on its way/);
    expect(getShopPaymentStatus.mock.calls.length).toBeGreaterThan(1);
  });
});
