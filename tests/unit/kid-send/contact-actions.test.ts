import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const context = vi.fn();

vi.mock("@/lib/family/session", () => ({ getFamilyContext: () => context() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => ({ insert: (row: unknown) => (insert(row), Promise.resolve({ error: null })) }) }),
}));

import { requestContact } from "@/app/kid/contact-actions";

beforeEach(() => {
  insert.mockClear();
  context.mockReturnValue({ kind: "kid", userId: "u1", familyId: "f1", kidId: "kid_1", deviceId: "d1" });
});

describe("requestContact", () => {
  it("files an add_contact request for the guardian", async () => {
    expect(await requestContact(" Grandpa ")).toEqual({ ok: true, label: "Grandpa" });
    expect(insert).toHaveBeenCalledWith({ family_id: "f1", kid_id: "kid_1", type: "add_contact", payload: { label: "Grandpa" }, status: "pending" });
  });

  it("refuses a bad name without writing", async () => {
    expect((await requestContact("")).ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("only works from a paired kid device", async () => {
    context.mockReturnValue({ kind: "guardian", userId: "u1", familyId: "f1", label: "Parent" });
    expect((await requestContact("Grandpa")).ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});
