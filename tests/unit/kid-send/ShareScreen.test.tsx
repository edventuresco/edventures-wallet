// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ShareScreen } from "@/components/kid/ShareScreen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

const base = {
  contacts: [
    { id: "c_gran", label: "Grandma", avatarId: "person" },
    { id: "c_sib", label: "Sam", avatarId: "bunny" },
  ],
  shareDisplay: "$1.25",
  shareUnits: "1250000",
  parentName: "Mum",
};

function tap(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("ShareScreen", () => {
  it("picks a person, an amount within the share jar, then asks a parent", async () => {
    const onRequest = vi.fn().mockResolvedValue({ ok: true });
    render(<ShareScreen {...base} onRequest={onRequest} />);
    expect(screen.queryByRole("button", { name: /Ask to add someone/ })).toBeNull();
    tap("Grandma");
    expect(screen.getByText("Your share jar has $1.25")).toBeTruthy();
    tap("$2");
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    tap("$1");
    tap("Next");
    expect(screen.getByText("Share $1.00 with Grandma?")).toBeTruthy();
    await act(async () => {
      tap("Ask Mum");
    });
    expect(onRequest).toHaveBeenCalledWith("c_gran", "1.00");
    expect(screen.getByText(/We asked Mum/)).toBeTruthy();
  });

  it("shows the reason when the ask is refused", async () => {
    const onRequest = vi.fn().mockResolvedValue({ ok: false, message: "Your share jar is empty right now. Your next allowance adds to it." });
    render(<ShareScreen {...base} onRequest={onRequest} />);
    tap("Sam");
    tap("$1");
    tap("Next");
    await act(async () => {
      tap("Ask Mum");
    });
    expect(screen.getByText(/share jar is empty/)).toBeTruthy();
  });

  it("offers a one-tap share once a parent has said yes, and celebrates", async () => {
    const onShare = vi.fn().mockResolvedValue({ ok: true });
    render(<ShareScreen {...base} onRequest={vi.fn()} onShare={onShare} approvedShare={{ requestId: "r1", contactId: "c_gran", dollars: "1.00" }} />);
    expect(screen.getByText("Mum said yes")).toBeTruthy();
    await act(async () => {
      tap(/Tap to share \$1\.00 with Grandma/);
    });
    expect(onShare).toHaveBeenCalledWith("c_gran", "1.00");
    expect(screen.getByText("Shared. Grandma has your $1.00.")).toBeTruthy();
  });

  it("tells the kid a share is still waiting on a parent", () => {
    render(<ShareScreen {...base} onRequest={vi.fn()} pendingShare={{ contactId: "c_sib", dollars: "1.00" }} />);
    expect(screen.getByText(/We asked Mum about \$1\.00 for Sam/)).toBeTruthy();
  });
});
