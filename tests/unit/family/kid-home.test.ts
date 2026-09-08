import { describe, expect, it } from "vitest";
import { buildKidHomeView, type KidHomeInput } from "@/lib/family/kid-home";
import { dollarsToUnits } from "@/lib/money/usdc";

const TZ = "Asia/Kuching"; // UTC+8, no DST
const NOW = new Date("2026-09-10T06:00:00Z"); // Thursday 14:00 local

const units = (d: string) => Number(dollarsToUnits(d));

function input(overrides: Partial<KidHomeInput> = {}): KidHomeInput {
  return {
    now: NOW,
    timeZone: TZ,
    kid: { id: "kid_1", name: "Alex", avatar_id: "otter", owl_name: null },
    jars: { spend: dollarsToUnits("7.50"), save: dollarsToUnits("12"), share: dollarsToUnits("1.25") },
    dailyLimitUnits: dollarsToUnits("50"),
    contacts: [
      { id: "c_mum", label: "Mum", avatar_id: "parent", address: "MUM", weekly_limit_units: units("50"), status: "active" },
      { id: "c_sib", label: "Sam", avatar_id: "bunny", address: "SAM", weekly_limit_units: units("5"), status: "active" },
      { id: "c_req", label: "Grandma", avatar_id: "person", address: "GRAN", weekly_limit_units: units("2"), status: "requested" },
    ],
    allowance: { amount_units: units("8"), next_run_at: "2026-09-14T01:00:00Z" },
    events: [],
    ...overrides,
  };
}

describe("buildKidHomeView", () => {
  it("shows the three jars as display strings", () => {
    const view = buildKidHomeView(input());
    expect(view.jars).toEqual({ spend: "$7.50", save: "$12.00", share: "$1.25" });
  });

  it("names the kid, their avatar and their owl", () => {
    const view = buildKidHomeView(input());
    expect(view.kid).toEqual({ id: "kid_1", name: "Alex", avatarId: "otter", owlName: "Owl", owlNamed: false });
    const named = buildKidHomeView(input({ kid: { id: "kid_1", name: "Alex", avatar_id: "otter", owl_name: "Pip" } })).kid;
    expect(named.owlName).toBe("Pip");
    expect(named.owlNamed).toBe(true);
  });

  it("takes today's sends off the daily limit, in the family's day", () => {
    const view = buildKidHomeView(
      input({
        events: [
          { id: "e1", kind: "sent", amount_units: units("2"), counterparty: "SAM", summary: "You sent Sam $2.00", created_at: "2026-09-10T01:00:00Z" },
          { id: "e2", kind: "sent", amount_units: units("3"), counterparty: "SAM", summary: "You sent Sam $3.00", created_at: "2026-09-09T15:00:00Z" }, // 23:00 local yesterday
          { id: "e3", kind: "received", amount_units: units("9"), counterparty: "MUM", summary: "Mum sent you $9.00", created_at: "2026-09-10T02:00:00Z" },
        ],
      }),
    );
    expect(view.dailyLeftUnits).toBe(String(units("48")));
    expect(view.dailyLeftDisplay).toBe("$48.00");
  });

  it("never reports a negative daily left", () => {
    const view = buildKidHomeView(
      input({
        dailyLimitUnits: dollarsToUnits("5"),
        events: [{ id: "e1", kind: "sent", amount_units: units("9"), counterparty: "SAM", summary: "", created_at: "2026-09-10T01:00:00Z" }],
      }),
    );
    expect(view.dailyLeftUnits).toBe("0");
  });

  it("lists only active contacts with what is left for each this week", () => {
    const view = buildKidHomeView(
      input({
        events: [
          { id: "e1", kind: "sent", amount_units: units("1.50"), counterparty: "SAM", summary: "", created_at: "2026-09-08T01:00:00Z" },
          { id: "e2", kind: "sent", amount_units: units("4"), counterparty: "SAM", summary: "", created_at: "2026-08-20T01:00:00Z" }, // older than a week
        ],
      }),
    );
    expect(view.contacts).toEqual([
      { id: "c_mum", label: "Mum", avatarId: "parent", weeklyLeftDisplay: "$50.00 left this week" },
      { id: "c_sib", label: "Sam", avatarId: "bunny", weeklyLeftDisplay: "$3.50 left this week" },
    ]);
  });

  it("uses the parent contact's label for approval copy", () => {
    expect(buildKidHomeView(input()).parentLabel).toBe("Mum");
    const guardian = input();
    guardian.contacts[0].label = "Guardian";
    expect(buildKidHomeView(guardian).parentLabel).toBe("Guardian");
    expect(buildKidHomeView(input({ contacts: [] })).parentLabel).toBe("Mum");
  });

  it("says when the allowance is coming", () => {
    expect(buildKidHomeView(input()).allowance).toEqual({ amountDisplay: "$8.00", whenLabel: "Allowance in 4 days" });
    expect(buildKidHomeView(input({ allowance: { amount_units: units("8"), next_run_at: "2026-09-11T01:00:00Z" } })).allowance?.whenLabel).toBe("Allowance tomorrow");
    expect(buildKidHomeView(input({ allowance: { amount_units: units("8"), next_run_at: "2026-09-10T10:00:00Z" } })).allowance?.whenLabel).toBe("Allowance today");
    expect(buildKidHomeView(input({ allowance: null })).allowance).toBeNull();
  });

  it("keeps the five newest events as sentences with a day label", () => {
    const events = Array.from({ length: 7 }, (_, i) => ({
      id: `e${i}`,
      kind: "sent",
      amount_units: units("1"),
      counterparty: "SAM",
      summary: `Event ${i}`,
      created_at: new Date(NOW.getTime() - i * 86_400_000).toISOString(),
    }));
    const view = buildKidHomeView(input({ events }));
    expect(view.recent.map((r) => r.summary)).toEqual(["Event 0", "Event 1", "Event 2", "Event 3", "Event 4"]);
    expect(view.recent.map((r) => r.whenLabel)).toEqual(["Today", "Yesterday", "Tuesday", "Monday", "Sunday"]);
  });
});
