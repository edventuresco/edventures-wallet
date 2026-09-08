// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SendFlow } from "@/components/kid/send/SendFlow";

afterEach(cleanup);

const contacts = [
  { id: "c_sis", label: "Sister", avatarId: "bunny", weeklyLeftDisplay: "$3.00 left this week" },
  { id: "c_mum", label: "Mum", avatarId: "parent" },
];

function tap(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

async function goToConfirm(onSend: (contactId: string, dollars: string) => Promise<never | object>) {
  render(
    <SendFlow
      contacts={contacts}
      dailyLeftUnits={23_000_000n}
      onSend={onSend as never}
    />,
  );
  tap("Sister");
  expect(screen.getByText("You can send up to $23.00 today")).toBeTruthy();
  tap("2");
  tap(".");
  tap("5");
  tap("Next");
  expect(screen.getByText("Send $2.50 to Sister?")).toBeTruthy();
}

describe("SendFlow", () => {
  it("starts on the contact grid with an ask-to-add tile", () => {
    render(<SendFlow contacts={contacts} dailyLeftUnits={0n} onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Sister" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mum" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ask to add someone/ })).toBeTruthy();
  });

  it("pick → amount → confirm → celebrate when the send is ok", async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: true, explorerUrl: "https://example.test/tx" });
    await goToConfirm(onSend);
    await act(async () => {
      tap("Send");
    });
    expect(onSend).toHaveBeenCalledWith("c_sis", "2.50");
    expect(screen.getByText("Sent. Sister has your $2.50.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back home" })).toBeTruthy();
  });

  it("says a parent was asked when the send needs approval", async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: false, message: "Over the threshold", needsApproval: true });
    await goToConfirm(onSend);
    await act(async () => {
      tap("Send");
    });
    expect(screen.getByText("This one needs a parent. We asked Mum.")).toBeTruthy();
    expect(screen.queryByText("Over the threshold")).toBeNull();
  });

  it("shows the warm blocked message when the send is refused", async () => {
    const onSend = vi.fn().mockResolvedValue({
      ok: false,
      message: "Your list keeps your money safe. Only people Mum added can get money from you.",
    });
    await goToConfirm(onSend);
    await act(async () => {
      tap("Send");
    });
    expect(screen.getByText(/Your list keeps your money safe/)).toBeTruthy();
    expect(screen.queryByText(/Sent\./)).toBeNull();
  });

  it("'Not now' goes back to the amount pad without sending", async () => {
    const onSend = vi.fn();
    await goToConfirm(onSend);
    tap("Not now");
    expect(screen.getByTestId("amount-display").textContent).toBe("$2.50");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("calls onAskToAdd from the last tile", () => {
    const onAskToAdd = vi.fn();
    render(<SendFlow contacts={contacts} dailyLeftUnits={0n} onSend={vi.fn()} onAskToAdd={onAskToAdd} />);
    tap(/Ask to add someone/);
    expect(onAskToAdd).toHaveBeenCalled();
  });

  it("can start at the confirm card for a proposed send", () => {
    render(<SendFlow contacts={contacts} dailyLeftUnits={23_000_000n} onSend={vi.fn()} start={{ contactId: "c_sis", dollars: "2.50" }} />);
    expect(screen.getByText("Send $2.50 to Sister?")).toBeTruthy();
  });

  it("sends straight away when the start is an approved one-tap send", async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: true });
    await act(async () => {
      render(<SendFlow contacts={contacts} dailyLeftUnits={23_000_000n} onSend={onSend} start={{ contactId: "c_sis", dollars: "2.50", sendNow: true }} />);
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("c_sis", "2.50");
    expect(screen.getByText("Sent. Sister has your $2.50.")).toBeTruthy();
  });

  it("reports every result so the home can remember why a send stopped", async () => {
    const onResult = vi.fn();
    const onSend = vi.fn().mockResolvedValue({ ok: false, message: "Only people Mum added can get money from you." });
    await goToConfirm(onSend);
    await act(async () => {
      tap("Send");
    });
    expect(onResult).not.toHaveBeenCalled();
    cleanup();
    render(<SendFlow contacts={contacts} dailyLeftUnits={23_000_000n} onSend={onSend} onResult={onResult} start={{ contactId: "c_sis", dollars: "1.00" }} />);
    await act(async () => {
      tap("Send");
    });
    expect(onResult).toHaveBeenCalledWith({ ok: false, message: "Only people Mum added can get money from you." });
  });
});
