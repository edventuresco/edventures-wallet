import { describe, expect, it } from "vitest";
import { TxError } from "@/lib/solana/tx";
import { reasonFor } from "@/lib/sponsor/reasons";
import { startOfTodayIso } from "@/lib/sponsor/policy";

const swigFail = (code: string) => new TxError("failed", [`Program swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB failed: custom program error: ${code}`]);

describe("reasonFor", () => {
  it("maps Swig 3006 to not on the list", () => {
    expect(reasonFor(swigFail("0xbbe"), 10_000_000n, 1_000_000n).code).toBe("not_on_list");
  });
  it("maps Swig 3032 to over that person's limit", () => {
    expect(reasonFor(swigFail("0xbd8"), 10_000_000n, 1_000_000n).code).toBe("over_person_limit");
  });
  it("tells insufficient funds apart from the daily cap by balance", () => {
    const err = new TxError("failed", ["Program swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB failed: insufficient funds for instruction"]);
    expect(reasonFor(err, 500_000n, 1_000_000n).code).toBe("not_enough_money");
    expect(reasonFor(err, 10_000_000n, 1_000_000n).code).toBe("over_daily_limit");
  });
  it("falls back to a generic retry", () => {
    expect(reasonFor(new Error("boom"), 0n, 0n).code).toBe("unknown");
  });
});

describe("startOfTodayIso", () => {
  it("is midnight in Kuching (UTC+8) expressed in UTC", () => {
    const now = new Date("2026-09-07T05:30:00Z"); // 13:30 in Kuching
    expect(startOfTodayIso(now, "Asia/Kuching")).toBe("2026-09-06T16:00:00.000Z");
  });
});
