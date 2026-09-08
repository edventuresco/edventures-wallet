import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const context = vi.fn();

vi.mock("@/lib/family/session", () => ({ getFamilyContext: () => context() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      upsert: (row: unknown, opts: unknown) => (upsert(row, opts), Promise.resolve({ error: null })),
      update: (row: unknown) => (update(row), { eq: (...args: unknown[]) => (eq(...args), Promise.resolve({ error: null })) }),
    }),
  }),
}));

import { saveGoal, saveSplit } from "@/app/kid/jar-actions";

beforeEach(() => {
  upsert.mockClear();
  update.mockClear();
  eq.mockClear();
  context.mockReturnValue({ kind: "kid", userId: "u1", familyId: "f1", kidId: "kid_1", deviceId: "d1" });
});

describe("saveGoal", () => {
  it("upserts the kid's one goal with the target in base units", async () => {
    const result = await saveGoal({ title: "Headphones", emoji: "🎧", dollars: "40" });
    expect(result).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith({ kid_id: "kid_1", title: "Headphones", emoji: "🎧", target_units: 40_000_000 }, { onConflict: "kid_id" });
  });

  it("refuses a bad goal without writing", async () => {
    const result = await saveGoal({ title: "", emoji: "🎧", dollars: "40" });
    expect(result.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("only works from a paired kid device", async () => {
    context.mockReturnValue({ kind: "guardian", userId: "u1", familyId: "f1", label: "Parent" });
    expect((await saveGoal({ title: "Bike", emoji: "🚲", dollars: "40" })).ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("saveSplit", () => {
  it("updates the kid's own split", async () => {
    const result = await saveSplit({ spend: 60, save: 30, share: 10 });
    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ spend_pct: 60, save_pct: 30, share_pct: 10 });
    expect(eq).toHaveBeenCalledWith("id", "kid_1");
  });

  it("refuses a split that does not add up", async () => {
    expect((await saveSplit({ spend: 60, save: 30, share: 20 })).ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
