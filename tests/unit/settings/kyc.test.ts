import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KYC_TEST_DETAILS, maskCustomerId, normalizeKyc, registerFamilyForPayments, toRegisterCustomerRequest, validateKyc, type KycInput } from "@/lib/shop/kyc";
import { MockSqrilClient } from "@/lib/sqril/mock";
import { SqrilApiError, SqrilNetworkError, type SqrilClient } from "@/lib/sqril/client";

const NOW = new Date("2026-09-07T00:00:00Z");

const check = (patch: Partial<KycInput>, now = NOW) => validateKyc({ ...KYC_TEST_DETAILS, ...patch }, now);

describe("validateKyc", () => {
  it("accepts the test details and returns them normalized", () => {
    const result = validateKyc(KYC_TEST_DETAILS, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phone).toBe("+60100000000");
    expect(result.value.email).toBe("parent@example.com");
    expect(result.value.idExpiry).toBe("");
  });

  it("uppercases codes, strips phone separators and spaces in the ID number, trims everything", () => {
    const value = normalizeKyc({ ...KYC_TEST_DETAILS, fullName: "  Test   Parent ", nationality: "my", country: " sg", idType: "pp", idNumber: "a 1234 567", postcode: "sw1a 1aa", phone: "+60 (10) 000-0000", email: "Parent@Example.com " });
    expect(value).toMatchObject({ fullName: "Test Parent", nationality: "MY", country: "SG", idType: "PP", idNumber: "A1234567", postcode: "SW1A 1AA", phone: "+60100000000", email: "parent@example.com" });
  });

  it("does not throw on missing or non-string input", () => {
    expect(validateKyc(null, NOW)).toMatchObject({ ok: false, field: "fullName" });
    expect(validateKyc({ fullName: 42 as unknown as string }, NOW)).toMatchObject({ ok: false, field: "fullName" });
  });

  it("needs a first and last name made of letters", () => {
    expect(check({ fullName: "" })).toMatchObject({ ok: false, field: "fullName", error: "Enter their first and last name." });
    expect(check({ fullName: "Cher" })).toMatchObject({ ok: false, field: "fullName", error: "Enter their first and last name." });
    expect(check({ fullName: "R2 D2!" })).toMatchObject({ ok: false, field: "fullName" });
    expect(check({ fullName: "Nurul Ain binti Ahmad" }).ok).toBe(true);
    expect(check({ fullName: "Anne-Marie O'Neil" }).ok).toBe(true);
  });

  it("needs a real date of birth for an adult", () => {
    expect(check({ dateOfBirth: "1990-13-01" })).toMatchObject({ ok: false, field: "dateOfBirth", error: "Enter the date of birth as YYYY-MM-DD." });
    expect(check({ dateOfBirth: "1990-02-30" })).toMatchObject({ ok: false, field: "dateOfBirth" });
    expect(check({ dateOfBirth: "01/01/1990" })).toMatchObject({ ok: false, field: "dateOfBirth" });
    expect(check({ dateOfBirth: "2010-01-01" })).toMatchObject({ ok: false, field: "dateOfBirth", error: "The registered parent needs to be 18 or over." });
    expect(check({ dateOfBirth: "2030-01-01" })).toMatchObject({ ok: false, field: "dateOfBirth" });
    // 18 today counts; 18 tomorrow does not.
    expect(check({ dateOfBirth: "2008-09-07" }).ok).toBe(true);
    expect(check({ dateOfBirth: "2008-09-08" })).toMatchObject({ ok: false, field: "dateOfBirth" });
  });

  it("checks gender, country codes, address, city and postcode", () => {
    expect(check({ gender: "" })).toMatchObject({ ok: false, field: "gender" });
    expect(check({ gender: "X" })).toMatchObject({ ok: false, field: "gender" });
    expect(check({ gender: "m" }).ok).toBe(true);
    expect(check({ nationality: "MYS" })).toMatchObject({ ok: false, field: "nationality" });
    expect(check({ addressLine: " " })).toMatchObject({ ok: false, field: "addressLine" });
    expect(check({ city: "" })).toMatchObject({ ok: false, field: "city" });
    expect(check({ postcode: "1" })).toMatchObject({ ok: false, field: "postcode" });
    expect(check({ postcode: "93000!" })).toMatchObject({ ok: false, field: "postcode" });
    expect(check({ country: "Malaysia" })).toMatchObject({ ok: false, field: "country" });
  });

  it("checks the ID type, number and expiry", () => {
    expect(check({ idType: "" })).toMatchObject({ ok: false, field: "idType" });
    expect(check({ idType: "ID" })).toMatchObject({ ok: false, field: "idType" });
    expect(check({ idNumber: "12" })).toMatchObject({ ok: false, field: "idNumber" });
    expect(check({ idNumber: "12#4567" })).toMatchObject({ ok: false, field: "idNumber" });
    expect(check({ idExpiry: "soon" })).toMatchObject({ ok: false, field: "idExpiry" });
    expect(check({ idExpiry: "2020-01-01" })).toMatchObject({ ok: false, field: "idExpiry", error: "That ID has expired." });
    expect(check({ idExpiry: "2026-09-07" })).toMatchObject({ ok: false, field: "idExpiry" });
    expect(check({ idExpiry: "2031-05-01" }).ok).toBe(true);
  });

  it("checks the phone (E.164) and the email", () => {
    expect(check({ phone: "0100000000" })).toMatchObject({ ok: false, field: "phone" });
    expect(check({ phone: "+0100000000" })).toMatchObject({ ok: false, field: "phone" });
    expect(check({ phone: "+6012" })).toMatchObject({ ok: false, field: "phone" });
    expect(check({ phone: "+44 7700 900123" }).ok).toBe(true);
    expect(check({ email: "parent" })).toMatchObject({ ok: false, field: "email" });
    expect(check({ email: "parent@example" })).toMatchObject({ ok: false, field: "email" });
    expect(check({ email: "" })).toMatchObject({ ok: false, field: "email" });
  });
});

describe("toRegisterCustomerRequest", () => {
  const validated = () => {
    const result = validateKyc(KYC_TEST_DETAILS, NOW);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };

  it("fills all fourteen Sqril fields from the test details", () => {
    expect(toRegisterCustomerRequest(validated())).toEqual({
      name_first: "Test",
      name_last: "Parent",
      gender: "F",
      ic_number: "000000000000",
      ic_type: "NIC",
      ic_country: "MY",
      occupation: "OCC2",
      country_of_residence: "MY",
      phone: "+60100000000",
      email: "parent@example.com",
      nationality: "MY",
      dob: "1990-01-01",
      address: "1 Jalan Test, Kuching 93000",
      ic_expiry_date: "2099-01-01",
    });
  });

  it("keeps everything but the last word as the first name", () => {
    const request = toRegisterCustomerRequest({ ...validated(), fullName: "Nurul Ain Ahmad" });
    expect(request.name_first).toBe("Nurul Ain");
    expect(request.name_last).toBe("Ahmad");
  });

  it("uses the residence country as the issuer for a permit or licence, the nationality for an ID or passport", () => {
    const base = { ...validated(), nationality: "ID", country: "MY" };
    expect(toRegisterCustomerRequest({ ...base, idType: "WEP" }).ic_country).toBe("MY");
    expect(toRegisterCustomerRequest({ ...base, idType: "DL" }).ic_country).toBe("MY");
    expect(toRegisterCustomerRequest({ ...base, idType: "PP" }).ic_country).toBe("ID");
    expect(toRegisterCustomerRequest({ ...base, idType: "NIC" }).ic_country).toBe("ID");
  });

  it("passes a given expiry through", () => {
    expect(toRegisterCustomerRequest({ ...validated(), idExpiry: "2031-05-01" }).ic_expiry_date).toBe("2031-05-01");
  });
});

describe("maskCustomerId", () => {
  it("shows the ends only, and nothing of a short id", () => {
    expect(maskCustomerId("mock-cust-0123456789abcdef")).toBe("mock…cdef");
    expect(maskCustomerId("short")).toBe("••••");
  });
});

/** Just enough of the Supabase builder for registerFamilyForPayments: one families table. */
function fakeAdmin(families: Record<string, { sqril_customer_id: string | null }>, opts: { raceWinner?: string } = {}) {
  const updates: unknown[] = [];
  const admin = {
    updates,
    from(table: string) {
      if (table !== "families") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () => ({ data: families[id] ?? null, error: null }),
          }),
        }),
        update: (payload: { sqril_customer_id: string }) => ({
          eq: (_col: string, id: string) => ({
            is: () => ({
              select: () => ({
                maybeSingle: async () => {
                  updates.push(payload);
                  const row = families[id];
                  if (!row || row.sqril_customer_id !== null) return { data: null, error: null };
                  if (opts.raceWinner) {
                    row.sqril_customer_id = opts.raceWinner;
                    return { data: null, error: null };
                  }
                  row.sqril_customer_id = payload.sqril_customer_id;
                  return { data: { sqril_customer_id: row.sqril_customer_id }, error: null };
                },
              }),
            }),
          }),
        }),
      };
    },
  };
  return admin as unknown as SupabaseClient & { updates: unknown[] };
}

describe("registerFamilyForPayments", () => {
  it("registers the parent with Sqril and stores the customer id on the family", async () => {
    const client = new MockSqrilClient();
    const register = vi.spyOn(client, "registerCustomer");
    const families = { f1: { sqril_customer_id: null } };
    const admin = fakeAdmin(families);

    const result = await registerFamilyForPayments("f1", KYC_TEST_DETAILS, client, admin);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyEnabled).toBe(false);
    expect(result.customerId).toMatch(/^mock-cust-[0-9a-f]{16}$/);
    expect(families.f1.sqril_customer_id).toBe(result.customerId);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0][0]).toMatchObject({ name_first: "Test", name_last: "Parent", ic_number: "000000000000", phone: "+60100000000" });
  });

  it("keeps an existing customer without calling Sqril", async () => {
    const client = new MockSqrilClient();
    const register = vi.spyOn(client, "registerCustomer");
    const admin = fakeAdmin({ f1: { sqril_customer_id: "mock-cust-existing0000000" } });

    const result = await registerFamilyForPayments("f1", KYC_TEST_DETAILS, client, admin);

    expect(result).toEqual({ ok: true, customerId: "mock-cust-existing0000000", alreadyEnabled: true });
    expect(register).not.toHaveBeenCalled();
    expect(admin.updates).toEqual([]);
  });

  it("rejects bad details before touching Sqril or the database", async () => {
    const client = new MockSqrilClient();
    const register = vi.spyOn(client, "registerCustomer");
    const admin = fakeAdmin({ f1: { sqril_customer_id: null } });

    const result = await registerFamilyForPayments("f1", { ...KYC_TEST_DETAILS, email: "nope" }, client, admin);

    expect(result).toMatchObject({ ok: false, field: "email" });
    expect(register).not.toHaveBeenCalled();
    expect(admin.updates).toEqual([]);
  });

  it("fails closed without an admin client or a Sqril client", async () => {
    expect(await registerFamilyForPayments("f1", KYC_TEST_DETAILS, new MockSqrilClient(), null)).toMatchObject({ ok: false, error: expect.stringContaining("right now") });
    const admin = fakeAdmin({ f1: { sqril_customer_id: null } });
    expect(await registerFamilyForPayments("f1", KYC_TEST_DETAILS, null, admin)).toMatchObject({ ok: false, error: expect.stringContaining("isn't configured") });
    expect(admin.updates).toEqual([]);
  });

  it("reports a family that does not exist", async () => {
    const result = await registerFamilyForPayments("missing", KYC_TEST_DETAILS, new MockSqrilClient(), fakeAdmin({}));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Couldn't find your family") });
  });

  it("passes Sqril's rejection reason back to the guardian", async () => {
    const client = {
      registerCustomer: async () => {
        throw new SqrilApiError(400, { error_code: "INVALID_REQUEST", error_message: "ic_number must be 12 digits" });
      },
    } as unknown as SqrilClient;
    const admin = fakeAdmin({ f1: { sqril_customer_id: null } });

    const result = await registerFamilyForPayments("f1", KYC_TEST_DETAILS, client, admin);

    expect(result).toEqual({ ok: false, error: "The payment service didn't accept those details: ic_number must be 12 digits" });
    expect(admin.updates).toEqual([]);
  });

  it("says the service was unreachable on a network error", async () => {
    const client = {
      registerCustomer: async () => {
        throw new SqrilNetworkError(new Error("ECONNREFUSED"));
      },
    } as unknown as SqrilClient;

    const result = await registerFamilyForPayments("f1", KYC_TEST_DETAILS, client, fakeAdmin({ f1: { sqril_customer_id: null } }));

    expect(result).toEqual({ ok: false, error: "Couldn't reach the payment service. Try again." });
  });

  it("keeps whichever id landed first when two guardians race", async () => {
    const admin = fakeAdmin({ f1: { sqril_customer_id: null } }, { raceWinner: "mock-cust-theotherparent" });

    const result = await registerFamilyForPayments("f1", KYC_TEST_DETAILS, new MockSqrilClient(), admin);

    expect(result).toEqual({ ok: true, customerId: "mock-cust-theotherparent", alreadyEnabled: true });
  });
});
