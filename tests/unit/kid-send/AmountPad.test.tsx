// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AmountPad } from "@/components/kid/send/AmountPad";

afterEach(cleanup);

function press(...keys: string[]) {
  for (const key of keys) {
    fireEvent.click(screen.getByRole("button", { name: key }));
  }
}

function nextDisabled() {
  return (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled;
}

function display() {
  return screen.getByTestId("amount-display").textContent;
}

describe("AmountPad", () => {
  it("starts at $0.00 with confirm disabled", () => {
    render(<AmountPad onConfirm={() => {}} />);
    expect(display()).toBe("$0.00");
    expect(nextDisabled()).toBe(true);
  });

  it("formats typed digits live with two decimals", () => {
    render(<AmountPad onConfirm={() => {}} />);
    press("2");
    expect(display()).toBe("$2.00");
    press(".", "5");
    expect(display()).toBe("$2.50");
  });

  it("never shows leading zeros", () => {
    render(<AmountPad onConfirm={() => {}} />);
    press("0", "0", "7");
    expect(display()).toBe("$7.00");
  });

  it("caps at two decimals and ignores a second dot", () => {
    render(<AmountPad onConfirm={() => {}} />);
    press("1", ".", "2", "3", "4", ".", "9");
    expect(display()).toBe("$1.23");
  });

  it("caps whole dollars at four digits", () => {
    render(<AmountPad onConfirm={() => {}} />);
    press("1", "2", "3", "4", "5");
    expect(display()).toBe("$1,234.00");
  });

  it("deletes the last key", () => {
    render(<AmountPad onConfirm={() => {}} />);
    press("2", ".", "5");
    press("Delete");
    expect(display()).toBe("$2.00");
    press("Delete", "Delete");
    expect(display()).toBe("$0.00");
  });

  it("quick amounts replace what was typed", () => {
    render(<AmountPad onConfirm={() => {}} />);
    press("3");
    press("$5");
    expect(display()).toBe("$5.00");
    press("$1");
    expect(display()).toBe("$1.00");
    press("$2");
    expect(display()).toBe("$2.00");
  });

  it("confirms with a normalised two-decimal dollar string", () => {
    const onConfirm = vi.fn();
    render(<AmountPad onConfirm={onConfirm} />);
    press("2", ".", "5");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onConfirm).toHaveBeenCalledWith("2.50");
  });

  it("shows the hint and holds the confirm when the amount is over the max", () => {
    render(<AmountPad maxUnits={23_000_000n} hint="You can send up to $23.00 today" onConfirm={() => {}} />);
    expect(screen.getByText("You can send up to $23.00 today")).toBeTruthy();
    press("3", "0");
    expect(nextDisabled()).toBe(true);
    expect(screen.getByText(/up to \$23\.00/)).toBeTruthy();
    press("Delete");
    expect(nextDisabled()).toBe(false);
  });
});
