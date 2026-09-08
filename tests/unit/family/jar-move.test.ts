import { describe, expect, it } from "vitest";
import { checkJarBalance, jarMoveSummary, jarSourceHint, validateJarMove, type JarMoveKind } from "@/lib/family/jar-move";

// The server receives untyped input, so the share jar must be refused at runtime too.
const share = "share" as JarMoveKind;
import { dollarsToUnits } from "@/lib/money/usdc";

describe("validateJarMove", () => {
  it("allows spend to save and save to spend with a positive dollar amount", () => {
    expect(validateJarMove({ from: "spend", to: "save", dollars: "2.50" })).toEqual({ ok: true, move: { from: "spend", to: "save", units: dollarsToUnits("2.50") } });
    expect(validateJarMove({ from: "save", to: "spend", dollars: "1" }).ok).toBe(true);
  });

  it("refuses the same jar twice, the share jar, and bad amounts", () => {
    expect(validateJarMove({ from: "spend", to: "spend", dollars: "2" }).ok).toBe(false);
    expect(validateJarMove({ from: "spend", to: share, dollars: "2" }).ok).toBe(false);
    expect(validateJarMove({ from: share, to: "spend", dollars: "2" }).ok).toBe(false);
    expect(validateJarMove({ from: "spend", to: "save", dollars: "0" }).ok).toBe(false);
    expect(validateJarMove({ from: "spend", to: "save", dollars: "abc" }).ok).toBe(false);
    expect(validateJarMove({ from: "spend", to: "save", dollars: "1.234" }).ok).toBe(false);
  });
});

describe("checkJarBalance", () => {
  it("passes when the source jar holds enough", () => {
    expect(checkJarBalance({ from: "spend", units: dollarsToUnits("2"), balanceUnits: dollarsToUnits("2") })).toEqual({ ok: true });
  });

  it("explains in the kid's words when it does not", () => {
    expect(checkJarBalance({ from: "spend", units: dollarsToUnits("5"), balanceUnits: dollarsToUnits("2.50") })).toEqual({
      ok: false,
      message: "You have $2.50 to spend right now. Try a smaller amount.",
    });
    expect(checkJarBalance({ from: "save", units: dollarsToUnits("5"), balanceUnits: 0n })).toEqual({
      ok: false,
      message: "Your jar is empty right now.",
    });
  });
});

describe("copy", () => {
  it("writes the event sentence for each direction", () => {
    expect(jarMoveSummary("spend", dollarsToUnits("2"))).toBe("Put $2.00 in your jar");
    expect(jarMoveSummary("save", dollarsToUnits("2"))).toBe("Took $2.00 back from your jar");
  });

  it("tells the kid what the source jar holds before they pick an amount", () => {
    expect(jarSourceHint("spend", "$7.50")).toBe("You have $7.50 to spend");
    expect(jarSourceHint("save", "$12.00")).toBe("Your jar has $12.00");
  });
});
