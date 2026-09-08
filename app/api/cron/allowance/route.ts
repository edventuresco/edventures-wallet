import type { SupabaseClient } from "@supabase/supabase-js";
import { cronAuthorized } from "@/lib/allowance/cron";
import { allowanceEventRows } from "@/lib/allowance/events";
import { AllowanceError, sendAllowanceOnChain } from "@/lib/allowance/keeper";
import { nextMondayAt } from "@/lib/rules/allowance";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type DueRow = { id: string; family_id: string; kid_id: string; amount_units: number; next_run_at: string };
type Outcome = { kidId: string; status: "paid"; signature: string } | { kidId: string; status: "skipped"; reason: string } | { kidId: string; status: "failed"; error: string };

/**
 * The scheduled allowance run (vercel.json: Monday 01:00 UTC, 09:00 Kuching).
 * Pays every allowance whose next_run_at has passed, records the same events
 * as "Pay now", and moves each schedule to the following Monday 09:00 family
 * time. Only the scheduler may call it: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return new Response("Unauthorized", { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return Response.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 500 });

  const now = new Date();
  const { data, error } = await admin.from("allowances").select("id,family_id,kid_id,amount_units,next_run_at").lte("next_run_at", now.toISOString()).order("next_run_at");
  if (error) return Response.json({ ok: false, error: "Couldn't read the allowances due" }, { status: 500 });

  const outcomes: Outcome[] = [];
  for (const row of (data as DueRow[] | null) ?? []) outcomes.push(await payDue(admin, row, now));
  const failed = outcomes.filter((o): o is Extract<Outcome, { status: "failed" }> => o.status === "failed");
  for (const f of failed) console.error(`cron.allowance: kid ${f.kidId}: ${f.error}`);
  return Response.json({ ok: failed.length === 0, ranAt: now.toISOString(), due: outcomes.length, outcomes });
}

async function payDue(admin: SupabaseClient, row: DueRow, now: Date): Promise<Outcome> {
  const kidId = row.kid_id;
  const [familyResult, guardianResult, walletResult] = await Promise.all([
    admin.from("families").select("timezone").eq("id", row.family_id).maybeSingle(),
    admin.from("guardians").select("user_id").eq("family_id", row.family_id).order("created_at").limit(1).maybeSingle(),
    admin.from("wallets").select("id").eq("kid_id", kidId).eq("kind", "spend").maybeSingle(),
  ]);
  const family = familyResult.data as { timezone: string } | null;
  const guardian = guardianResult.data as { user_id: string } | null;
  if (!family || !guardian) return { kidId, status: "failed", error: "The family or its guardian is missing" };

  // Claim the row by moving its schedule first, so two overlapping runs cannot both pay it.
  const nextRunAt = nextMondayAt(now, family.timezone).toISOString();
  const { data: claimed } = await admin.from("allowances").update({ next_run_at: nextRunAt, updated_at: now.toISOString() }).eq("id", row.id).eq("next_run_at", row.next_run_at).select("id");
  if (!claimed || claimed.length === 0) return { kidId, status: "skipped", reason: "Already handled by another run" };

  const amountUnits = BigInt(row.amount_units);
  try {
    const receipt = await sendAllowanceOnChain({ familyId: row.family_id, kidId, amountUnits });
    const walletId = (walletResult.data as { id: string } | null)?.id ?? null;
    const { error } = await admin.from("events").insert(allowanceEventRows({ userId: guardian.user_id, familyId: row.family_id, kidId, walletId, amountUnits, receipt }));
    if (error) console.error(`cron.allowance: kid ${kidId}: paid (${receipt.signature}) but the events could not be recorded: ${error.message}`);
    await admin.from("allowances").update({ last_paid_at: now.toISOString() }).eq("id", row.id);
    return { kidId, status: "paid", signature: receipt.signature };
  } catch (error) {
    // A pre-flight refusal sent nothing: give the row back so the next run retries it.
    if (error instanceof AllowanceError) await admin.from("allowances").update({ next_run_at: row.next_run_at }).eq("id", row.id);
    return { kidId, status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}
