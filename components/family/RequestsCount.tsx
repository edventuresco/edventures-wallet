import { getFamilyContext } from "@/lib/family/session";
import { createClient } from "@/lib/supabase/server";
import { RequestsBadge } from "./RequestsBadge";

/**
 * The live pending-requests badge on its own, for the Requests tab in the
 * bottom nav. Guardians only; anyone else gets nothing. Pass it as the
 * destination's `badge` node from a server component.
 */
export async function RequestsCount() {
  try {
    const ctx = await getFamilyContext();
    if (ctx.kind !== "guardian") return null;
    const supabase = await createClient();
    const [{ data: kids }, { count }] = await Promise.all([
      supabase.from("kids").select("id,name").eq("family_id", ctx.familyId),
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("family_id", ctx.familyId).eq("status", "pending"),
    ]);
    const kidNames = Object.fromEntries((kids ?? []).map((k) => [k.id as string, k.name as string]));
    return <RequestsBadge familyId={ctx.familyId} initialPending={count ?? 0} kidNames={kidNames} />;
  } catch {
    // No Supabase env (a bare checkout): the tab shows without a count.
    return null;
  }
}
