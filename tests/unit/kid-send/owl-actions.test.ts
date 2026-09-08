import { beforeEach, describe, expect, it, vi } from "vitest";

const update = vi.fn();
const eq = vi.fn();
const context = vi.fn();

vi.mock("@/lib/family/session", () => ({ getFamilyContext: () => context() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => ({ update: (row: unknown) => (update(row), { eq: (...args: unknown[]) => (eq(...args), Promise.resolve({ error: null })) }) }) }),
}));

import { nameOwl } from "@/app/kid/owl-actions";

beforeEach(() => {
  update.mockClear();
  eq.mockClear();
  context.mockReturnValue({ kind: "kid", userId: "u1", familyId: "f1", kidId: "kid_1", deviceId: "d1" });
});

describe("nameOwl", () => {
  it("saves a clean name on the kid's own row", async () => {
    const result = await nameOwl("  Pip ");
    expect(result).toEqual({ ok: true, name: "Pip" });
    expect(update).toHaveBeenCalledWith({ owl_name: "Pip" });
    expect(eq).toHaveBeenCalledWith("id", "kid_1");
  });

  it("refuses a bad name without touching the database or echoing it", async () => {
    const result = await nameOwl("x");
    expect(result).toEqual({ ok: false, error: "Try another name" });
    expect(update).not.toHaveBeenCalled();
  });

  it("only works from a paired kid device", async () => {
    context.mockReturnValue({ kind: "guardian", userId: "u1", familyId: "f1", label: "Parent" });
    const result = await nameOwl("Pip");
    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
