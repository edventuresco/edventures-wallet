import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@solana/web3.js";

/**
 * A tiny stand-in for the Supabase query builder: every chain method returns
 * the builder, terminal reads resolve from `reads[table]`, and writes are
 * recorded in `writes` so the test can assert on them.
 */
type Op = { table: string; op: string; payload?: unknown; filters: Array<[string, ...unknown[]]> };
const writes: Op[] = [];
const reads: Record<string, unknown[]> = {};

function builder(table: string, op: string, payload?: unknown) {
  const self: Record<string, unknown> = {};
  const state: Op = { table, op, payload, filters: [] };
  const chain = (name: string) => {
    self[name] = (...args: unknown[]) => {
      state.filters.push([name, ...args]);
      return self;
    };
  };
  for (const name of ["select", "eq", "neq", "is", "not", "order", "limit"]) chain(name);
  const read = () => {
    const rows = (reads[table] ?? []) as Array<Record<string, unknown>>;
    const eqs = state.filters.filter(([n]) => n === "eq") as Array<[string, string, unknown]>;
    const row = rows.find((r) => eqs.every(([, col, v]) => r[col] === v)) ?? null;
    return Promise.resolve({ data: row, error: null });
  };
  self.maybeSingle = read;
  self.single = read;
  self.then = (resolve: (v: unknown) => void) => {
    if (op !== "select") writes.push(state);
    return resolve({ data: null, error: null });
  };
  return self;
}

const fakeSupabase = {
  from: (table: string) => ({
    select: (...args: unknown[]) => (builder(table, "select").select as (...a: unknown[]) => unknown)(...args),
    insert: (payload: unknown) => builder(table, "insert", payload),
    update: (payload: unknown) => builder(table, "update", payload),
  }),
};

const context = vi.fn();
vi.mock("@/lib/family/session", () => ({ getFamilyContext: () => context() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeSupabase }));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "u1", email: null }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { addContact, removeContact } from "@/app/family/rules/actions";

const ADDRESS = Keypair.generate().publicKey.toBase58();

beforeEach(() => {
  writes.length = 0;
  for (const key of Object.keys(reads)) delete reads[key];
  reads.families = [{ id: "f1", name: "Us", timezone: "Asia/Kuching" }];
  reads.kids = [{ id: "kid_1", family_id: "f1", name: "Alex" }];
  reads.contacts = [];
  context.mockReturnValue({ kind: "guardian", userId: "u1", familyId: "f1", label: "Parent" });
});

describe("addContact", () => {
  it("inserts an active, not-yet-synced contact for a kid in the family", async () => {
    const result = await addContact({ kidId: "kid_1", label: "Grandma", avatarId: "person", address: ADDRESS, weeklyDollars: "20" });
    expect(result).toEqual({ ok: true });
    expect(writes).toEqual([
      expect.objectContaining({
        table: "contacts",
        op: "insert",
        payload: { family_id: "f1", kid_id: "kid_1", label: "Grandma", avatar_id: "person", address: ADDRESS, weekly_limit_units: 20_000_000, status: "active", onchain_synced: false },
      }),
    ]);
  });

  it("brings back a removed contact at the same address instead of duplicating it", async () => {
    reads.contacts = [{ id: "c_old", kid_id: "kid_1", address: ADDRESS, status: "removed" }];
    const result = await addContact({ kidId: "kid_1", label: "Grandma", avatarId: "person", address: ADDRESS, weeklyDollars: "20" });
    expect(result).toEqual({ ok: true });
    expect(writes[0]).toEqual(
      expect.objectContaining({
        table: "contacts",
        op: "update",
        payload: { label: "Grandma", avatar_id: "person", weekly_limit_units: 20_000_000, status: "active", onchain_synced: false },
      }),
    );
    expect(writes[0].filters).toContainEqual(["eq", "id", "c_old"]);
  });

  it("says so when the address is already on the list", async () => {
    reads.contacts = [{ id: "c_1", kid_id: "kid_1", address: ADDRESS, status: "active" }];
    const result = await addContact({ kidId: "kid_1", label: "Grandma", avatarId: "person", address: ADDRESS, weeklyDollars: "20" });
    expect(result).toEqual({ ok: false, error: "That address is already on Alex's list." });
    expect(writes).toEqual([]);
  });

  it("refuses bad input and kids outside the family", async () => {
    expect((await addContact({ kidId: "kid_1", label: "", avatarId: "person", address: ADDRESS, weeklyDollars: "20" })).ok).toBe(false);
    expect((await addContact({ kidId: "kid_other", label: "Grandma", avatarId: "person", address: ADDRESS, weeklyDollars: "20" })).ok).toBe(false);
    context.mockReturnValue({ kind: "kid", userId: "u2", familyId: "f1", kidId: "kid_1", deviceId: "d1" });
    expect((await addContact({ kidId: "kid_1", label: "Grandma", avatarId: "person", address: ADDRESS, weeklyDollars: "20" })).ok).toBe(false);
    expect(writes).toEqual([]);
  });
});

describe("removeContact", () => {
  it("marks the contact removed and waiting for an on-chain update", async () => {
    reads.contacts = [{ id: "c_1", kid_id: "kid_1", family_id: "f1", address: ADDRESS, status: "active" }];
    expect(await removeContact("c_1")).toEqual({ ok: true });
    expect(writes[0]).toEqual(expect.objectContaining({ table: "contacts", op: "update", payload: { status: "removed", onchain_synced: false } }));
    expect(writes[0].filters).toContainEqual(["eq", "id", "c_1"]);
    expect(writes[0].filters).toContainEqual(["eq", "family_id", "f1"]);
  });

  it("only a guardian can remove", async () => {
    context.mockReturnValue({ kind: "kid", userId: "u2", familyId: "f1", kidId: "kid_1", deviceId: "d1" });
    expect((await removeContact("c_1")).ok).toBe(false);
    expect(writes).toEqual([]);
  });
});
