// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReceiveScreen } from "@/components/wallet/ReceiveScreen";

afterEach(cleanup);

const address = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

describe("ReceiveScreen", () => {
  it("shows the QR, the address and copies it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ReceiveScreen state={{ address, qrSvg: "<svg><title>qr</title></svg>" }} />);

    expect(screen.getByRole("img", { name: /QR code for your wallet address/ })).toBeTruthy();
    expect(screen.getByText(address)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
    expect(writeText).toHaveBeenCalledWith(address);
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
  });

  it("points at the wallet when there is none yet", () => {
    render(<ReceiveScreen state={{ address: null, qrSvg: null }} />);
    expect(screen.getByRole("link", { name: "Create my wallet" }).getAttribute("href")).toBe("/wallet");
  });
});
