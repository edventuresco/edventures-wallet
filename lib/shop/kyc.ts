// Payments are opt-in. Sqril needs one fully identified adult as the sender
// of every payout, so a parent registers the family from Settings with the
// KYC form this module validates; the customer id lands in
// families.sqril_customer_id, and kids are switched on one at a time
// (kids.shop_pay_enabled). Staging only: test details, never a real identity.
//
// Everything here is pure except registerFamilyForPayments, which takes its
// Sqril client and admin Supabase client as arguments (no env reads), so the
// Settings screen can import the validator and run it in the browser first.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SqrilClient } from "@/lib/sqril/client";
import type { IcType, Occupation, RegisterCustomerRequest } from "@/lib/sqril/types";

export type KycInput = {
  fullName: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  /** "M" or "F" (what Sqril accepts). */
  gender: string;
  /** ISO 3166 alpha-2. */
  nationality: string;
  addressLine: string;
  city: string;
  postcode: string;
  /** ISO 3166 alpha-2: where they live. */
  country: string;
  /** NIC, PP, DL or WEP. */
  idType: string;
  idNumber: string;
  /** YYYY-MM-DD, or blank for a document that does not expire. */
  idExpiry: string;
  /** E.164, spaces allowed. */
  phone: string;
  email: string;
};

export type KycField = keyof KycInput;

export const ID_TYPES: ReadonlyArray<{ value: IcType; label: string }> = [
  { value: "NIC", label: "National ID" },
  { value: "PP", label: "Passport" },
  { value: "DL", label: "Driving licence" },
  { value: "WEP", label: "Work permit" },
];

export const GENDERS: ReadonlyArray<{ value: "F" | "M"; label: string }> = [
  { value: "F", label: "Female" },
  { value: "M", label: "Male" },
];

/** Sqril's marker for a document that does not expire. */
export const NON_EXPIRING = "2099-01-01";

/**
 * Sqril requires an occupation code but documents only the enum (OCC1-OCC12).
 * Staging accepts OCC2, the value its own test parent carries; ask Sqril for
 * the list before real onboarding and turn this into a field.
 */
export const DEFAULT_OCCUPATION: Occupation = "OCC2";

/** Obviously fake, never a person: all-zero document, example.com, a reserved-looking phone. */
export const KYC_TEST_DETAILS: KycInput = {
  fullName: "Test Parent",
  dateOfBirth: "1990-01-01",
  gender: "F",
  nationality: "MY",
  addressLine: "1 Jalan Test",
  city: "Kuching",
  postcode: "93000",
  country: "MY",
  idType: "NIC",
  idNumber: "000000000000",
  idExpiry: "",
  phone: "+60 10 000 0000",
  email: "parent@example.com",
};

export type KycCheck = { ok: true; value: KycInput } | { ok: false; field: KycField; error: string };

const ADULT_YEARS = 18;
const NAME_MAX = 80;
const NAME_RE = /^[\p{L}][\p{L}' .-]*$/u;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const POSTCODE_RE = /^[A-Z0-9][A-Z0-9 -]{1,10}[A-Z0-9]$/;
const ID_NUMBER_RE = /^[A-Z0-9-]{4,32}$/;
const PHONE_RE = /^\+[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const tidy = (v: unknown) => str(v).trim().replace(/\s+/g, " ");

/** Trim everything, uppercase the codes, strip separators from the phone. Safe on untrusted input. */
export function normalizeKyc(input: Partial<KycInput> | null | undefined): KycInput {
  const raw = input ?? {};
  return {
    fullName: tidy(raw.fullName),
    dateOfBirth: tidy(raw.dateOfBirth),
    gender: tidy(raw.gender).toUpperCase(),
    nationality: tidy(raw.nationality).toUpperCase(),
    addressLine: tidy(raw.addressLine),
    city: tidy(raw.city),
    postcode: tidy(raw.postcode).toUpperCase(),
    country: tidy(raw.country).toUpperCase(),
    idType: tidy(raw.idType).toUpperCase(),
    idNumber: tidy(raw.idNumber).replace(/\s+/g, "").toUpperCase(),
    idExpiry: tidy(raw.idExpiry),
    phone: str(raw.phone).replace(/[\s().-]/g, ""),
    email: tidy(raw.email).toLowerCase(),
  };
}

/** A real calendar date in YYYY-MM-DD, as a UTC Date; null otherwise. */
function parseDate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

function yearsBetween(from: Date, to: Date): number {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const beforeBirthday = to.getUTCMonth() < from.getUTCMonth() || (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() < from.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years;
}

/** Every field Sqril needs, checked in form order; the first problem comes back with its field. */
export function validateKyc(input: Partial<KycInput> | null | undefined, now: Date = new Date()): KycCheck {
  const value = normalizeKyc(input);
  const fail = (field: KycField, error: string): KycCheck => ({ ok: false, field, error });

  if (!value.fullName) return fail("fullName", "Enter their first and last name.");
  if (value.fullName.length > NAME_MAX || !NAME_RE.test(value.fullName)) return fail("fullName", "Keep the name to letters, spaces, hyphens and apostrophes.");
  if (!value.fullName.includes(" ")) return fail("fullName", "Enter their first and last name.");

  const dob = parseDate(value.dateOfBirth);
  if (!dob) return fail("dateOfBirth", "Enter the date of birth as YYYY-MM-DD.");
  if (dob.getTime() > now.getTime() || yearsBetween(dob, now) < ADULT_YEARS) return fail("dateOfBirth", "The registered parent needs to be 18 or over.");

  if (!GENDERS.some((g) => g.value === value.gender)) return fail("gender", "Pick a gender.");
  if (!COUNTRY_RE.test(value.nationality)) return fail("nationality", "Use a two-letter country code for nationality, like MY.");
  if (!value.addressLine || value.addressLine.length > 120) return fail("addressLine", "Enter the street address.");
  if (!value.city || value.city.length > 60) return fail("city", "Enter the city.");
  if (!POSTCODE_RE.test(value.postcode)) return fail("postcode", "Enter the postcode.");
  if (!COUNTRY_RE.test(value.country)) return fail("country", "Use a two-letter country code, like MY.");
  if (!ID_TYPES.some((t) => t.value === value.idType)) return fail("idType", "Pick the ID type.");
  if (!ID_NUMBER_RE.test(value.idNumber)) return fail("idNumber", "Enter the ID number: letters and numbers only.");

  if (value.idExpiry) {
    const expiry = parseDate(value.idExpiry);
    if (!expiry) return fail("idExpiry", "Enter the ID expiry as YYYY-MM-DD, or leave it blank.");
    if (expiry.getTime() <= now.getTime()) return fail("idExpiry", "That ID has expired.");
  }

  if (!PHONE_RE.test(value.phone)) return fail("phone", "Enter the phone with its country code, like +60 12 345 6789.");
  if (!value.email || value.email.length > 254 || !EMAIL_RE.test(value.email)) return fail("email", "Enter an email address.");

  return { ok: true, value };
}

/**
 * The issuing country of the document: the nationality for a national ID or
 * passport, the country of residence for a permit or licence.
 */
function issuingCountry(value: KycInput): string {
  return value.idType === "NIC" || value.idType === "PP" ? value.nationality : value.country;
}

/** Sqril's fourteen fields from a validated, normalized KycInput. */
export function toRegisterCustomerRequest(value: KycInput): RegisterCustomerRequest {
  const words = value.fullName.split(" ");
  return {
    name_first: words.slice(0, -1).join(" "),
    name_last: words[words.length - 1],
    gender: value.gender,
    ic_number: value.idNumber,
    ic_type: value.idType as IcType,
    ic_country: issuingCountry(value),
    occupation: DEFAULT_OCCUPATION,
    country_of_residence: value.country,
    phone: value.phone,
    email: value.email,
    nationality: value.nationality,
    dob: value.dateOfBirth,
    address: `${value.addressLine}, ${value.city} ${value.postcode}`,
    ic_expiry_date: value.idExpiry || NON_EXPIRING,
  };
}

/** "mock-cust-1234abcd" -> "mock…abcd": enough to recognise, not enough to reuse. */
export function maskCustomerId(id: string): string {
  return id.length <= 8 ? "••••" : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export type RegisterFamilyResult = { ok: true; customerId: string; alreadyEnabled: boolean } | { ok: false; error: string; field?: KycField };

const UNAVAILABLE = "Couldn't reach the payment service. Try again.";

function registerFailureMessage(err: unknown): string {
  const e = err as { name?: string; body?: { error_message?: string } | null } | null;
  if (e && typeof e === "object" && e.name === "SqrilApiError") {
    const detail = e.body?.error_message;
    return detail ? `The payment service didn't accept those details: ${detail}` : "The payment service didn't accept those details. Check them and try again.";
  }
  return UNAVAILABLE;
}

/**
 * Register the parent with Sqril and store the customer id on the family.
 * Idempotent: a family that already has a customer keeps it, and two
 * guardians racing here keep whichever id landed first. The caller passes
 * the clients (server code: getSqrilClient(), getSupabaseAdmin()).
 */
export async function registerFamilyForPayments(familyId: string, kyc: KycInput, client: SqrilClient | null, admin: SupabaseClient | null): Promise<RegisterFamilyResult> {
  const check = validateKyc(kyc);
  if (!check.ok) return { ok: false, error: check.error, field: check.field };
  if (!admin) return { ok: false, error: "Payments can't be switched on right now. Try again later." };

  const { data: family, error } = await admin.from("families").select("sqril_customer_id").eq("id", familyId).maybeSingle();
  if (error || !family) return { ok: false, error: "Couldn't find your family. Refresh and try again." };
  const existing = (family as { sqril_customer_id: string | null }).sqril_customer_id;
  if (existing) return { ok: true, customerId: existing, alreadyEnabled: true };

  if (!client) return { ok: false, error: "The payment service isn't configured on this server yet." };
  let customerId: string;
  try {
    customerId = (await client.registerCustomer(toRegisterCustomerRequest(check.value))).customer_id;
  } catch (err) {
    return { ok: false, error: registerFailureMessage(err) };
  }
  if (!customerId) return { ok: false, error: "The payment service didn't give us a customer id. Try again." };

  // Only fill an empty slot: two guardians racing here keep whichever id landed first.
  const { data: updated } = await admin.from("families").update({ sqril_customer_id: customerId }).eq("id", familyId).is("sqril_customer_id", null).select("sqril_customer_id").maybeSingle();
  const stored = (updated as { sqril_customer_id: string } | null)?.sqril_customer_id;
  if (stored) return { ok: true, customerId: stored, alreadyEnabled: false };
  const { data: again } = await admin.from("families").select("sqril_customer_id").eq("id", familyId).maybeSingle();
  const winner = (again as { sqril_customer_id: string | null } | null)?.sqril_customer_id;
  return winner ? { ok: true, customerId: winner, alreadyEnabled: true } : { ok: false, error: "The payment service registered you but we couldn't save it. Try again." };
}
