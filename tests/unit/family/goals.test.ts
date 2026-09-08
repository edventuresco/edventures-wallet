import { describe, expect, it } from "vitest";
import { goalOwnerLabel, goalSummary, setAsideAvailable, targetDateLabel, validateGoalDraft, validateSetAside, type Contribution, closedLabel } from "@/lib/family/goals";

const now = new Date("2026-09-08T10:00:00Z");
const draft = { title: "Japan together", kind: "trip" as const, dollars: "6000", targetDate: "", kidId: null };

describe("validateGoalDraft", () => {
  it("accepts a trip with a target and no date, and gives it the trip emoji", () => {
    const check = validateGoalDraft(draft, now);
    expect(check.ok && check.goal).toEqual({ title: "Japan together", kind: "trip", emoji: "✈️", targetUnits: 6_000_000_000n, targetDate: null, kidId: null });
  });
  it("keeps the date when it is ahead and refuses one that has passed", () => {
    const ahead = validateGoalDraft({ ...draft, targetDate: "2026-12-20" }, now);
    expect(ahead.ok && ahead.goal.targetDate).toBe("2026-12-20");
    expect(validateGoalDraft({ ...draft, targetDate: "2026-09-07" }, now).ok).toBe(false);
    expect(validateGoalDraft({ ...draft, targetDate: "next year" }, now).ok).toBe(false);
  });
  it("needs a name, a known kind and a sensible target", () => {
    expect(validateGoalDraft({ ...draft, title: "  " }, now).ok).toBe(false);
    expect(validateGoalDraft({ ...draft, kind: "holiday" as never }, now).ok).toBe(false);
    expect(validateGoalDraft({ ...draft, dollars: "0" }, now).ok).toBe(false);
    expect(validateGoalDraft({ ...draft, dollars: "100001" }, now).ok).toBe(false);
    expect(validateGoalDraft({ ...draft, dollars: "$1,250.50" }, now).ok).toBe(true);
  });
  it("a goal for one kid keeps the kid", () => {
    const check = validateGoalDraft({ ...draft, kidId: "kid-1" }, now);
    expect(check.ok && check.goal.kidId).toBe("kid-1");
  });
});

const c = (over: Partial<Contribution>): Contribution => ({ id: "c", userId: "u1", kidId: null, name: "Maya", units: 0n, releasedAt: null, createdAt: "2026-09-01T00:00:00Z", ...over });

describe("goalSummary", () => {
  it("adds up unreleased contributions per person, largest first, with their share of what is saved", () => {
    const s = goalSummary(
      [
        c({ id: "1", units: 2_000_000_000n }),
        c({ id: "2", units: 900_000_000n }),
        c({ id: "3", userId: null, kidId: "k1", name: "Aria", units: 430_000_000n }),
        c({ id: "4", userId: null, kidId: "k2", name: "Eli", units: 350_000_000n }),
        c({ id: "5", units: 5_000_000_000n, releasedAt: "2026-09-02T00:00:00Z" }),
      ],
      6_000_000_000n,
    );
    expect(s.savedDisplay).toBe("$3,680.00");
    expect(s.progress.percent).toBe(61);
    expect(s.contributors.map((x) => [x.name, x.display, x.percentLabel])).toEqual([
      ["Maya", "$2,900.00", "78%"],
      ["Aria", "$430.00", "11%"],
      ["Eli", "$350.00", "9%"],
    ]);
  });
  it("is empty with nothing saved", () => {
    const s = goalSummary([], 1_000_000n);
    expect(s.savedUnits).toBe(0n);
    expect(s.progress.percent).toBe(0);
    expect(s.contributors).toEqual([]);
  });
});

describe("setting money aside", () => {
  it("only what the family wallet holds beyond existing earmarks is free", () => {
    expect(setAsideAvailable({ familyWalletUnits: 100_000_000n, earmarkedUnits: 30_000_000n })).toBe(70_000_000n);
    expect(setAsideAvailable({ familyWalletUnits: 10_000_000n, earmarkedUnits: 30_000_000n })).toBe(0n);
  });
  it("refuses more than is free and says how much is", () => {
    expect(validateSetAside("25", 70_000_000n)).toEqual({ ok: true, units: 25_000_000n });
    const over = validateSetAside("80", 70_000_000n);
    expect(over.ok).toBe(false);
    expect(!over.ok && over.error).toMatch(/\$70\.00 free/);
    expect(validateSetAside("1", 0n).ok).toBe(false);
    expect(validateSetAside("abc", 70_000_000n).ok).toBe(false);
  });
});

describe("labels", () => {
  it("names the owner", () => {
    expect(goalOwnerLabel(null)).toBe("Family goal");
    expect(goalOwnerLabel("Mia")).toBe("Mia's goal");
    expect(goalOwnerLabel("James")).toBe("James' goal");
  });
  it("formats the date", () => {
    expect(targetDateLabel("2026-12-20")).toBe("By 20 Dec 2026");
    expect(targetDateLabel(null)).toBeNull();
  });
});

describe("closedLabel", () => {
  it("names the day a goal was closed in the family's timezone", () => {
    expect(closedLabel("2026-09-08T07:02:37.302Z", "Asia/Kuala_Lumpur")).toBe("Closed 8 Sep 2026");
    expect(closedLabel("2026-09-08T17:30:00Z", "Pacific/Auckland")).toBe("Closed 9 Sep 2026");
  });
});
