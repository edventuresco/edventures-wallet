// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SplitScreen } from "@/components/kid/SplitScreen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

function value(label: string) {
  return (screen.getByLabelText(label) as HTMLInputElement).value;
}

describe("SplitScreen", () => {
  it("starts from last week's split and shows the dollars each jar would get", () => {
    render(<SplitScreen split={{ spend: 50, save: 40, share: 10 }} allowanceDisplay="$8.00" allowanceUnits="8000000" onSave={vi.fn()} />);
    expect(value("Spend")).toBe("50");
    expect(value("Save")).toBe("40");
    expect(value("Share")).toBe("10");
    expect(screen.getByText("$4.00")).toBeTruthy();
    expect(screen.getByText("$3.20")).toBeTruthy();
    expect(screen.getByText("$0.80")).toBeTruthy();
  });

  it("keeps the three jars adding up to 100 when one slider moves", () => {
    render(<SplitScreen split={{ spend: 50, save: 40, share: 10 }} allowanceDisplay="$8.00" allowanceUnits="8000000" onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Spend"), { target: { value: "30" } });
    expect(value("Spend")).toBe("30");
    expect(Number(value("Save")) + Number(value("Share"))).toBe(70);
  });

  it("saves the split and refreshes", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<SplitScreen split={{ spend: 50, save: 40, share: 10 }} allowanceDisplay="$8.00" allowanceUnits="8000000" onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Spend"), { target: { value: "30" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "That's my split" }));
    });
    expect(onSave).toHaveBeenCalledWith({ spend: 30, save: 56, share: 14 });
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText(/Saved/)).toBeTruthy();
  });
});
