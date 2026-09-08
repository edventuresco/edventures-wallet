import type { SupabaseClient } from "@supabase/supabase-js";

export const SPONSORED_PER_DAY = 10;

/** Event kinds the fee payer paid for; only these count toward the daily cap. */
export const SPONSORED_KINDS = ["sent", "funded", "saved", "shared"] as const;

/** Start of today in the family timezone, as an ISO instant. */
export function startOfTodayIso(now = new Date(), timeZone = "Asia/Kuching"): string {
  const local = new Date(now.toLocaleString("en-US", { timeZone }));
  const startLocal = new Date(local.getFullYear(), local.getMonth(), local.getDate());
  const offsetMs = local.getTime() - now.getTime();
  return new Date(startLocal.getTime() - offsetMs).toISOString();
}

/**
 * Sponsored transactions this user has made since local midnight. Rows the
 * demo reset marked sponsor_counted = false stay in the history but do not
 * count. A query error throws rather than reading as zero, so a missing
 * column (migration not applied) cannot quietly lift the cap.
 */
export async function countSponsoredToday(supabase: SupabaseClient, userId: string, timeZone = "Asia/Kuching"): Promise<number> {
  const { count, error } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("kind", [...SPONSORED_KINDS])
    .eq("sponsor_counted", true)
    .gte("created_at", startOfTodayIso(new Date(), timeZone));
  if (error) throw new Error(`countSponsoredToday: ${error.message}`);
  return count ?? 0;
}
