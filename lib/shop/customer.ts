// The family's Sqril customer. Sqril needs a fully identified adult as the
// sender of every payout, so each family carries one customer id in
// families.sqril_customer_id. A parent puts it there from Settings
// (lib/shop/kyc.ts, registerFamilyForPayments); nothing here registers
// anyone, least of all on a kid's behalf. Server-only: reads with the admin
// client because it runs inside the kid's own session.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type EnsureCustomerResult = { ok: true; customerId: string } | { ok: false; message: string };

/** What a kid hears when the family has not opted into payments. */
export const PAYMENTS_NOT_ENABLED_MESSAGE = "Shop payments aren't switched on for your family yet. A parent can turn them on in Settings.";

/**
 * families.sqril_customer_id, or a kid-readable reason there is none.
 * Returns a message rather than throwing: this runs on the kid's screen.
 */
export async function ensureSqrilCustomer(familyId: string, admin: SupabaseClient | null = getSupabaseAdmin()): Promise<EnsureCustomerResult> {
  if (!admin) return { ok: false, message: "Paying shops isn't switched on right now. Ask a parent." };
  const { data: family, error } = await admin.from("families").select("sqril_customer_id").eq("id", familyId).maybeSingle();
  if (error || !family) return { ok: false, message: "We couldn't find your family. Ask a parent to check the app." };
  const customerId = (family as { sqril_customer_id: string | null }).sqril_customer_id;
  return customerId ? { ok: true, customerId } : { ok: false, message: PAYMENTS_NOT_ENABLED_MESSAGE };
}
