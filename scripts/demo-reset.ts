// Demo reset for one family: a fresh sponsorship allowance, no stale requests
// or pending raises, expired pairing codes gone, and an optional treasury
// top-up. Kids, wallets, contacts, allowances and past events stay. Runs
// against the Supabase project in .env.local with the service role; devnet
// only. The planning logic is pure and lives in lib/demo/reset.ts; this file
// is the I/O around it.
//
//   npm run demo:reset -- --family <family id | guardian email> --dry-run
//   npm run demo:reset -- --family <family id | guardian email> [--topup 100] [--yes]

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PublicKey } from "@solana/web3.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveFamilyRef } from "@/lib/demo/family-ref";
import { formatPlan, parseDemoResetArgs, planDemoReset, USAGE, type DemoResetPlan, type FamilySnapshot } from "@/lib/demo/reset";
import { ataFor } from "@/lib/family/onchain";
import { explorerUrl } from "@/lib/solana/explorer";
import { mintDollarsTo } from "@/lib/solana/mint";
import { startOfTodayIso } from "@/lib/sponsor/policy";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SPONSOR_MIGRATION = "supabase/migrations/20260907090000_events_sponsor_counted.sql";

type DbError = { message: string; code?: string } | null;
type DbResult = { data: unknown; error: DbError };

function check(step: string, error: DbError): void {
  if (error) throw new Error(`${step}: ${error.message}`);
}

function rows<T>(step: string, res: DbResult): T[] {
  check(step, res.error);
  return (res.data as T[] | null) ?? [];
}

// --- Load -------------------------------------------------------------------

/** False until the sponsor_counted migration has been applied to this project. */
async function hasSponsorColumn(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.from("events").select("sponsor_counted").limit(1);
  if (!error) return true;
  if (error.code === "42703" || /sponsor_counted/.test(error.message)) return false;
  throw new Error(`events: ${error.message}`);
}

async function loadSnapshot(admin: SupabaseClient, familyId: string, since: string, sponsorColumn: boolean): Promise<FamilySnapshot> {
  const familyRes = await admin.from("families").select("id,name,timezone").eq("id", familyId).single();
  check("families", familyRes.error);
  const family = familyRes.data as FamilySnapshot["family"];
  const byFamily = (table: string, columns: string) => admin.from(table).select(columns).eq("family_id", familyId);

  const guardians = rows<{ user_id: string; label: string }>("guardians", await byFamily("guardians", "user_id,label"));
  const kids = rows<FamilySnapshot["kids"][number]>("kids", await byFamily("kids", "id,name"));
  const devices = rows<FamilySnapshot["devices"][number]>("devices", await byFamily("devices", "id,kid_id,user_id,status,pairing_expires_at"));
  const wallets = rows<FamilySnapshot["wallets"][number]>("wallets", await byFamily("wallets", "id,kid_id,kind,wallet_address"));
  const limits = rows<FamilySnapshot["limits"][number]>("limits", await byFamily("limits", "id,kid_id,pending_raise"));
  const requests = rows<FamilySnapshot["requests"][number]>("requests", await byFamily("requests", "id,kid_id,type,status"));

  // Sponsored events carry user_id, not family_id (app/wallet/actions.ts), so look them up by member.
  const memberIds = [...guardians.map((g) => g.user_id), ...devices.flatMap((d) => (d.user_id && d.kid_id ? [d.user_id] : []))];
  const eventColumns = sponsorColumn ? "id,user_id,kind,created_at,sponsor_counted" : "id,user_id,kind,created_at";
  const events =
    memberIds.length === 0
      ? []
      : rows<{ id: string; user_id: string; kind: string; created_at: string; sponsor_counted?: boolean }>(
          "events",
          await admin.from("events").select(eventColumns).in("user_id", memberIds).gte("created_at", since),
        );

  const emails = await Promise.all(guardians.map(async (g) => (await admin.auth.admin.getUserById(g.user_id)).data.user?.email ?? null));

  return {
    family,
    guardians: guardians.map((g, i) => ({ ...g, email: emails[i] })),
    kids,
    devices,
    wallets,
    limits,
    requests,
    events: events.map((e) => ({ ...e, sponsor_counted: e.sponsor_counted ?? true })),
  };
}

// --- Apply ------------------------------------------------------------------

async function applyStep(step: string, ids: string[], run: () => PromiseLike<DbResult>): Promise<void> {
  if (ids.length === 0) {
    console.log(`  ${step}: nothing to do`);
    return;
  }
  const res = await run();
  check(step, res.error);
  const changed = ((res.data as unknown[] | null) ?? []).length;
  console.log(`  ${step}: ${changed} of ${ids.length} row${ids.length === 1 ? "" : "s"}`);
  if (changed !== ids.length) console.log("    (some rows changed between plan and apply; run --dry-run again to see the current state)");
}

async function applyPlan(admin: SupabaseClient, plan: DemoResetPlan): Promise<void> {
  const now = new Date().toISOString();
  const { sponsor, requests, pendingRaises, expiredPairings } = plan;
  await applyStep("sponsor counter", sponsor.eventIds, () => admin.from("events").update({ sponsor_counted: false }).in("id", sponsor.eventIds).select("id"));
  await applyStep("requests", requests.ids, () => admin.from("requests").delete().in("id", requests.ids).select("id"));
  await applyStep("pending raises", pendingRaises.limitIds, () => admin.from("limits").update({ pending_raise: null, updated_at: now }).in("id", pendingRaises.limitIds).select("id"));
  await applyStep("expired pairing codes", expiredPairings.deviceIds, () => admin.from("devices").delete().in("id", expiredPairings.deviceIds).select("id"));
}

/** Devnet only: the fee payer is the mint authority of the test USDC, and creates the treasury's token account if needed. */
async function applyTopup(topup: NonNullable<DemoResetPlan["topup"]>, ata: string): Promise<void> {
  const signature = await mintDollarsTo(new PublicKey(topup.walletAddress), topup.units);
  console.log(`  top-up: minted ${topup.dollars} to the family treasury`);
  console.log(`    tx        ${explorerUrl(signature, "tx")}`);
  console.log(`    treasury  ${explorerUrl(ata, "address")}`);
}

async function confirm(question: string): Promise<boolean> {
  if (!stdin.isTTY) return false;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

// --- Main -------------------------------------------------------------------

async function main(argv: string[]): Promise<number> {
  const args = parseDemoResetArgs(argv);
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
  if (cluster !== "devnet") throw new Error(`The demo reset is devnet only; NEXT_PUBLIC_SOLANA_CLUSTER is "${cluster}".`);
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");

  const now = new Date();
  const since = startOfTodayIso(now);
  const { familyId } = await resolveFamilyRef(admin, args.family, USAGE);
  const sponsorColumn = await hasSponsorColumn(admin);
  const snapshot = await loadSnapshot(admin, familyId, since, sponsorColumn);
  const plan = planDemoReset(snapshot, { now, since, topup: args.topup });
  const ata = plan.topup ? ataFor(plan.topup.walletAddress).toBase58() : null;

  console.log(formatPlan(plan, { dryRun: args.dryRun, ata }));
  if (!sponsorColumn) {
    console.log("");
    console.log(`Note: events.sponsor_counted does not exist yet, so the sponsor counter cannot be reset. Apply ${SPONSOR_MIGRATION} first.`);
  }
  if (args.dryRun) return 0;
  if (!sponsorColumn) {
    console.error("Nothing changed: apply the migration, then run again.");
    return 1;
  }
  if (!args.yes) {
    const ok = await confirm(`\nApply this to "${plan.family.name}"? [y/N] `);
    if (!ok) {
      console.log(stdin.isTTY ? "Nothing changed." : "Nothing changed: stdin is not a terminal, pass --yes to run without the prompt.");
      return 1;
    }
  }

  console.log("");
  console.log("Applying:");
  await applyPlan(admin, plan);
  if (plan.topup && ata) await applyTopup(plan.topup, ata);
  console.log("Done.");
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`demo-reset: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
