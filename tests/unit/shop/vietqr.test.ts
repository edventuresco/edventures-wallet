import { describe, expect, it } from "vitest";
import { parseVietQrSummary } from "@/lib/shop/vietqr";

// Real Sqril staging samples, dynamic 79,000 VND ("Ung Ho Quy Vac Xin" =
// vaccine-fund donation) and static (no amount encoded).
const DYNAMIC_SAMPLE =
  "00020101021238560010A0000007270126000697041501121133666688880208QRIBFTTA53037045405790005802VN62220818Ung Ho Quy Vac Xin63043ACF";
const STATIC_SAMPLE =
  "00020101021138590010A0000007270129000697043701150687040709939990208QRIBFTTA53037045802VN62190815KOHI NGUYEN HUE63047F33";

describe("parseVietQrSummary", () => {
  it("parses the dynamic sample: amount, currency, dynamic flag, purpose", () => {
    expect(parseVietQrSummary(DYNAMIC_SAMPLE)).toEqual({
      dynamic: true,
      amount: 79_000,
      currency: "VND",
      merchantLabel: "Ung Ho Quy Vac Xin",
    });
  });

  it("parses the static sample: no amount, still reads currency and label", () => {
    expect(parseVietQrSummary(STATIC_SAMPLE)).toEqual({
      dynamic: false,
      amount: undefined,
      currency: "VND",
      merchantLabel: "KOHI NGUYEN HUE",
    });
  });

  it("does not throw on garbage input", () => {
    expect(parseVietQrSummary("not a qr code")).toEqual({
      dynamic: false,
      amount: undefined,
      currency: undefined,
      merchantLabel: undefined,
    });
  });
});
