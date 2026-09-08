import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSqrilCustomer, PAYMENTS_NOT_ENABLED_MESSAGE } from "@/lib/shop/customer";

/** A read-only families table; any write would throw. */
function fakeAdmin(families: Record<string, { sqril_customer_id: string | null }>) {
  return {
    from: (table: string) => {
      if (table !== "families") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () => ({ data: families[id] ?? null, error: null }),
          }),
        }),
        update: () => {
          throw new Error("ensureSqrilCustomer must not write");
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("ensureSqrilCustomer", () => {
  it("returns the customer a parent registered from Settings", async () => {
    const result = await ensureSqrilCustomer("f1", fakeAdmin({ f1: { sqril_customer_id: "mock-cust-0123456789abcdef" } }));
    expect(result).toEqual({ ok: true, customerId: "mock-cust-0123456789abcdef" });
  });

  it("never registers anyone: a family without a customer is told to ask a parent", async () => {
    const result = await ensureSqrilCustomer("f1", fakeAdmin({ f1: { sqril_customer_id: null } }));
    expect(result).toEqual({ ok: false, message: PAYMENTS_NOT_ENABLED_MESSAGE });
    expect(PAYMENTS_NOT_ENABLED_MESSAGE).toBe("Shop payments aren't switched on for your family yet. A parent can turn them on in Settings.");
  });

  it("explains a missing family or an unconfigured server", async () => {
    expect(await ensureSqrilCustomer("nope", fakeAdmin({}))).toMatchObject({ ok: false, message: expect.stringContaining("couldn't find your family") });
    expect(await ensureSqrilCustomer("f1", null)).toMatchObject({ ok: false, message: expect.stringContaining("Ask a parent") });
  });
});
