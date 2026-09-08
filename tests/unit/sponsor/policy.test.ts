import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { countSponsoredToday, SPONSORED_KINDS } from "@/lib/sponsor/policy";

/** A query builder that records the chain and resolves to one canned result. */
function fakeClient(result: { count: number | null; error: { message: string } | null }) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of ["select", "eq", "in", "gte"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  const client = {
    from: (table: string) => {
      calls.push(["from", [table]]);
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("countSponsoredToday", () => {
  it("counts only sponsored kinds that are still marked as counted", async () => {
    const { client, calls } = fakeClient({ count: 4, error: null });
    await expect(countSponsoredToday(client, "user-1")).resolves.toBe(4);
    expect(calls).toContainEqual(["from", ["events"]]);
    expect(calls).toContainEqual(["eq", ["user_id", "user-1"]]);
    expect(calls).toContainEqual(["in", ["kind", [...SPONSORED_KINDS]]]);
    expect(calls).toContainEqual(["eq", ["sponsor_counted", true]]);
    expect(calls.find(([m]) => m === "gte")?.[1][0]).toBe("created_at");
  });
  it("reads a missing count as zero", async () => {
    const { client } = fakeClient({ count: null, error: null });
    await expect(countSponsoredToday(client, "user-1")).resolves.toBe(0);
  });
  it("fails closed: a query error throws instead of counting zero", async () => {
    const { client } = fakeClient({ count: null, error: { message: "column events.sponsor_counted does not exist" } });
    await expect(countSponsoredToday(client, "user-1")).rejects.toThrow(/sponsor_counted does not exist/);
  });
});
