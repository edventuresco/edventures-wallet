// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { KidHome } from "@/components/kid/KidHome";
import type { KidHomeView } from "@/lib/family/kid-home";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

const view: KidHomeView = {
  kid: { id: "kid_1", name: "Alex", avatarId: "otter", owlName: "Pip", owlNamed: true },
  parentLabel: "Mum",
  jars: { spend: "$7.50", save: "$12.00", share: "$1.25" },
  allowance: { amountDisplay: "$8.00", whenLabel: "Allowance in 4 days" },
  dailyLeftUnits: "23000000",
  dailyLeftDisplay: "$23.00",
  contacts: [
    { id: "c_mum", label: "Mum", avatarId: "parent", weeklyLeftDisplay: "$50.00 left this week" },
    { id: "c_sib", label: "Sam", avatarId: "bunny", weeklyLeftDisplay: "$3.50 left this week" },
  ],
  recent: [{ id: "e1", summary: "Mum sent you $9.00", whenLabel: "Today" }],
};

function tap(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("KidHome", () => {
  it("greets the kid and shows the three jars and the allowance", () => {
    render(<KidHome view={view} />);
    expect(screen.getByText("Hi Alex")).toBeTruthy();
    expect(screen.getByText("$7.50")).toBeTruthy();
    expect(screen.getByText("$12.00")).toBeTruthy();
    expect(screen.getByText("$1.25")).toBeTruthy();
    expect(screen.getByText("Allowance in 4 days")).toBeTruthy();
    expect(screen.getByText("Mum sent you $9.00")).toBeTruthy();
  });

  it("opens the send flow with the kid's people and today's limit", () => {
    render(<KidHome view={view} />);
    tap("Send");
    expect(screen.getByRole("button", { name: "Sam" })).toBeTruthy();
    tap("Sam");
    expect(screen.getByText("You can send up to $23.00 today")).toBeTruthy();
  });

  it("runs a send through onSend, then comes home and refreshes the balances", async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: true });
    render(<KidHome view={view} onSend={onSend} />);
    tap("Send");
    tap("Sam");
    tap("$2");
    tap("Next");
    await act(async () => {
      tap("Send");
    });
    expect(onSend).toHaveBeenCalledWith("c_sib", "2.00");
    expect(screen.getByText("Sent. Sam has your $2.00.")).toBeTruthy();
    tap("Back home");
    expect(screen.getByText("Hi Alex")).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });

  it("explains that sending is not ready when no onSend is wired", async () => {
    render(<KidHome view={view} />);
    tap("Send");
    tap("Sam");
    tap("$1");
    tap("Next");
    await act(async () => {
      tap("Send");
    });
    expect(screen.getByText(/isn't switched on yet/)).toBeTruthy();
  });

  it("uses the parent's label when a send needs approval", async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: false, message: "", needsApproval: true });
    render(<KidHome view={{ ...view, parentLabel: "Guardian" }} onSend={onSend} />);
    tap("Send");
    tap("Sam");
    tap("$1");
    tap("Next");
    await act(async () => {
      tap("Send");
    });
    expect(screen.getByText("This one needs a parent. We asked Guardian.")).toBeTruthy();
  });

  it("shows an approved send as one tap and sends it without the pad", async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: true });
    render(<KidHome view={view} onSend={onSend} approvedSend={{ requestId: "r1", contactId: "c_sib", dollars: "6.00" }} />);
    expect(screen.getByText("Mum said yes")).toBeTruthy();
    await act(async () => {
      tap(/Tap to send \$6\.00 to Sam/);
    });
    expect(onSend).toHaveBeenCalledWith("c_sib", "6.00");
    expect(screen.getByText("Sent. Sam has your $6.00.")).toBeTruthy();
  });

  it("mounts the owl with a typed box when the browser cannot listen", () => {
    render(<KidHome view={view} />);
    expect(screen.getByLabelText("Type a message to your owl")).toBeTruthy();
    expect(screen.queryByLabelText("Name your owl")).toBeNull();
  });

  it("asks the kid to name their owl until they have", async () => {
    const onNameOwl = vi.fn().mockResolvedValue({ ok: true });
    render(<KidHome view={{ ...view, kid: { ...view.kid, owlName: "Owl", owlNamed: false } }} onNameOwl={onNameOwl} />);
    const input = screen.getByLabelText("Name your owl");
    fireEvent.change(input, { target: { value: "Pip" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(onNameOwl).toHaveBeenCalledWith("Pip");
    expect(refresh).toHaveBeenCalled();
  });

  it("lets the kid ask for someone new by name, then says a parent was asked", async () => {
    const onAskToAdd = vi.fn().mockResolvedValue({ ok: true, label: "Grandpa" });
    render(<KidHome view={view} onAskToAdd={onAskToAdd} />);
    tap("Send");
    tap(/Ask to add someone/);
    const input = screen.getByLabelText("Who do you want to add?");
    fireEvent.change(input, { target: { value: "Grandpa" } });
    await act(async () => {
      tap("Ask Mum");
    });
    expect(onAskToAdd).toHaveBeenCalledWith("Grandpa");
    expect(screen.getByText(/We asked Mum/)).toBeTruthy();
    tap("Back home");
    expect(screen.getByText("Hi Alex")).toBeTruthy();
  });

  it("shows an approved share on the share card and shares it in one tap", async () => {
    const onShare = vi.fn().mockResolvedValue({ ok: true });
    render(<KidHome view={view} onShare={onShare} approvedShare={{ requestId: "r2", contactId: "c_sib", dollars: "1.00" }} />);
    expect(screen.getByText("Mum said yes, tap to share")).toBeTruthy();
    await act(async () => {
      tap(/Tap to share \$1\.00 with Sam/);
    });
    expect(onShare).toHaveBeenCalledWith("c_sib", "1.00");
    expect(screen.getByText("Shared. Sam has your $1.00.")).toBeTruthy();
  });
});
