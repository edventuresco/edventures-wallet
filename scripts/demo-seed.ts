// Demo seed for one family: kids with their three Swig wallets, limits and
// allowance (the rows app/family/actions.ts addKid writes), people on every
// kid's list, a funded treasury and "Pay a shop" on. Idempotent: whatever
// exists is kept, never duplicated. Runs against the Supabase project in
// .env.local with the service role; devnet only. The planning logic is pure
// and lives in lib/demo/seed.ts; this file is the I/O around it.
//
//   npm run demo:seed -- --family <family id | guardian email> --dry-run
//   npm run demo:seed -- --family <family id | guardian email> \
//     [--kids "Ten:2016,Eight:2018"] [--contacts "Grandma:<address>,Friend:<address>"] \
//     [--zara <address>] [--treasury 100] [--shop-pay] [--yes]
//
// Invites, the on-chain device approval and the keeper role need the
// guardian's device key, so they stay in the app; the seed prints where.

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PublicKey } from "@solana/web3.js";
import { getAccount, TokenAccountNotFoundError, TokenInvalidAccountOwnerError } from "@solana/spl-token";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveFamilyRef } from "@/lib/demo/family-ref";
import { formatNextSteps, formatSeedPlan, parseDemoSeedArgs, parseTreasury, planDemoSeed, resolveAddress, USAGE, type DemoSeedPlan, type KidPlan, type SeedSnapshot } from "@/lib/demo/seed";
import { DEFAULTS } from "@/lib/family/defaults";
import { ataFor, createKidWallets } from "@/lib/family/onchain";
import { unitsToDisplay } from "@/lib/money/usdc";
import { getConnection } from "@/lib/solana/connection";
import { explorerUrl } from "@/lib/solana/explorer";
import { keypairFromEnv } from "@/lib/solana/keys";
import { mintDollarsTo } from "@/lib/solana/mint";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type DbError = { message: string; code?: string } | null;
type DbResult = { data: unknown; error: DbError };

function check(step: string, error: DbError): void {
  if (error) throw new Error(`${step}: ${error.message}`);
}

function rows<T>(step: string, res: DbResult): T[] {
  check(step, res.error);
  return (res.data as T[] | null) ?? [];
}

const norm = (s: string): string => s.trim().toLowerCase();

// --- Load -------------------------------------------------------------------

/** The family wallet's USDC balance; 0 when its token account does not exist yet. Any other RPC failure throws. */
async function treasuryBalance(walletAddress: string): Promise<bigint> {
  try {
    return (await getAccount(getConnection(), ataFor(walletAddress))).amount;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) return 0n;
    throw error;
  }
}

async function loadSnapshot(admin: SupabaseClient, familyId: string, readTreasury: boolean): Promise<SeedSnapshot> {
  // `*` on families and kids: keeper_role_id and shop_pay_enabled come from migrations that may not be applied yet.
  const familyRes = await admin.from("families").select("*").eq("id", familyId).single();
  check("families", familyRes.error);
  const family = familyRes.data as SeedSnapshot["family"];
  const byFamily = (table: string, columns: string) => admin.from(table).select(columns).eq("family_id", familyId);

  const guardians = rows<{ user_id: string; label: string }>("guardians", await byFamily("guardians", "user_id,label").order("created_at"));
  const devices = rows<SeedSnapshot["devices"][number]>("devices", await byFamily("devices", "id,kid_id,user_id,status,pubkey"));
  const kids = rows<SeedSnapshot["kids"][number]>("kids", await byFamily("kids", "*").order("created_at"));
  const wallets = rows<SeedSnapshot["wallets"][number]>("wallets", await byFamily("wallets", "id,kid_id,kind,wallet_address"));
  const contacts = rows<SeedSnapshot["contacts"][number]>("contacts", await byFamily("contacts", "id,kid_id,label,address,status,onchain_synced"));
  const limits = rows<SeedSnapshot["limits"][number]>("limits", await byFamily("limits", "id,kid_id"));
  const allowances = rows<SeedSnapshot["allowances"][number]>("allowances", await byFamily("allowances", "id,kid_id"));
  const invites = rows<SeedSnapshot["invites"][number]>("kid_invites", await byFamily("kid_invites", "kid_id,email,created_at,accepted_at"));
  const emails = await Promise.all(guardians.map(async (g) => (await admin.auth.admin.getUserById(g.user_id)).data.user?.email ?? null));

  const treasury = wallets.find((w) => w.kind === "family" && w.kid_id === null);
  const treasuryUnits = readTreasury && treasury ? await treasuryBalance(treasury.wallet_address) : readTreasury ? 0n : null;

  return { family, guardians: guardians.map((g, i) => ({ ...g, email: emails[i] })), devices, kids, wallets, contacts, limits, allowances, invites, treasuryUnits };
}

// --- Apply ------------------------------------------------------------------

type Applied = { kidIds: Map<string, string>; spendByKid: Map<string, string> };

async function applyKid(admin: SupabaseClient, plan: DemoSeedPlan, kid: KidPlan, applied: Applied): Promise<void> {
  const familyId = plan.family.id;
  let kidId = kid.id;
  if (kid.create) {
    const res = await admin
      .from("kids")
      .insert({ family_id: familyId, name: kid.name, avatar_id: kid.avatarId, birth_month: kid.birthMonth, birth_year: kid.birthYear, spend_pct: DEFAULTS.split.spend, save_pct: DEFAULTS.split.save, share_pct: DEFAULTS.split.share })
      .select("id")
      .single();
    check(`kids (${kid.name})`, res.error);
    kidId = (res.data as { id: string }).id;
    console.log(`  ${kid.name}: kid row ${kidId}`);
  }
  if (!kidId) throw new Error(`applyKid: ${kid.name} has no kids.id`);
  applied.kidIds.set(norm(kid.name), kidId);

  if (kid.createWallets) {
    const wallets = await createKidWallets(new PublicKey(plan.root.pubkey));
    const wRes = await admin.from("wallets").insert(
      (["spend", "save", "share"] as const).map((kind) => ({
        family_id: familyId,
        kid_id: kidId,
        kind,
        swig_address: wallets[kind].swigAddress,
        wallet_address: wallets[kind].walletAddress,
        root_device_id: plan.root.deviceId,
      })),
    );
    check(`wallets (${kid.name}; the wallets exist on Solana but their rows were not saved)`, wRes.error);
    applied.spendByKid.set(norm(kid.name), wallets.spend.walletAddress);
    const eRes = await admin.from("events").insert({ user_id: plan.guardian.userId, family_id: familyId, kid_id: kidId, kind: "wallet_created", signature: wallets.spend.signature, summary: `${kid.name}'s wallet was created on Solana` });
    check(`events (${kid.name})`, eRes.error);
    console.log(`  ${kid.name}: wallets spend ${wallets.spend.walletAddress}, save ${wallets.save.walletAddress}, share ${wallets.share.walletAddress}`);
    console.log(`    tx  ${explorerUrl(wallets.spend.signature, "tx")}`);
  }
  if (kid.createLimits) {
    const res = await admin.from("limits").insert({
      family_id: familyId,
      kid_id: kidId,
      daily_limit_units: Number(DEFAULTS.kidDailyUnits),
      weekly_limit_units: Number(DEFAULTS.kidWeeklyUnits),
      approval_threshold_units: Number(DEFAULTS.approvalThresholdUnits),
    });
    check(`limits (${kid.name})`, res.error);
    console.log(`  ${kid.name}: limits row`);
  }
  if (kid.allowanceUnits !== null) {
    const res = await admin.from("allowances").insert({ family_id: familyId, kid_id: kidId, amount_units: Number(kid.allowanceUnits), next_run_at: plan.allowanceNextRunAt.toISOString() });
    check(`allowances (${kid.name})`, res.error);
    console.log(`  ${kid.name}: allowance ${unitsToDisplay(kid.allowanceUnits)} a week`);
  }
}

async function applyContacts(admin: SupabaseClient, plan: DemoSeedPlan, applied: Applied): Promise<void> {
  const { rows: planned } = plan.contacts;
  if (planned.length === 0) {
    console.log("  contacts: nothing to do");
    return;
  }
  const toRow = (c: (typeof planned)[number]) => {
    const kidId = applied.kidIds.get(norm(c.kidName));
    if (!kidId) throw new Error(`applyContacts: no kids.id for ${c.kidName}`);
    return { family_id: plan.family.id, kid_id: kidId, label: c.label, avatar_id: c.avatarId, address: resolveAddress(c.to, applied.spendByKid), weekly_limit_units: Number(c.weeklyUnits), status: "active", onchain_synced: false };
  };
  const inserts = planned.filter((c) => !c.reactivateId).map(toRow);
  if (inserts.length > 0) {
    const res = await admin.from("contacts").insert(inserts).select("id");
    check("contacts", res.error);
    console.log(`  contacts: ${rows("contacts", res).length} inserted`);
  }
  for (const c of planned.filter((c) => c.reactivateId)) {
    const { family_id, kid_id, address, ...row } = toRow(c);
    const step = `contacts (${c.kidName}: ${c.label})`;
    const res = await admin.from("contacts").update(row).eq("id", c.reactivateId).eq("family_id", family_id).eq("kid_id", kid_id).eq("address", address).select("id");
    if (rows(step, res).length !== 1) throw new Error(`${step}: the removed row changed between plan and apply; run --dry-run again.`);
    console.log(`  contacts: ${c.label} back on ${c.kidName}'s list`);
  }
}

async function applyShopPay(admin: SupabaseClient, plan: DemoSeedPlan, applied: Applied): Promise<void> {
  const names = plan.kids.filter((k) => k.shopPayOn).map((k) => k.name);
  if (names.length === 0) return;
  const ids = names.map((n) => {
    const id = applied.kidIds.get(norm(n));
    if (!id) throw new Error(`applyShopPay: no kids.id for ${n}`);
    return id;
  });
  const res = await admin.from("kids").update({ shop_pay_enabled: true }).in("id", ids).select("id");
  const changed = rows("kids.shop_pay_enabled", res).length;
  if (changed !== ids.length) throw new Error(`kids.shop_pay_enabled: ${changed} of ${ids.length} rows updated; run --dry-run again.`);
  console.log(`  pay a shop: on for ${names.join(", ")}`);
}

/** Devnet only: the fee payer is the mint authority of the test USDC, and creates the treasury's token account if needed. */
async function applyTreasury(plan: DemoSeedPlan, ata: string): Promise<void> {
  const treasury = plan.treasury;
  if (!treasury) return;
  if (treasury.mint === 0n) {
    console.log(`  treasury: already holds ${unitsToDisplay(treasury.held)}, nothing to mint`);
    return;
  }
  const signature = await mintDollarsTo(new PublicKey(plan.familyWallet.walletAddress), treasury.mint);
  console.log(`  treasury: minted ${unitsToDisplay(treasury.mint)}, now holds ${unitsToDisplay(treasury.target)}`);
  console.log(`    tx        ${explorerUrl(signature, "tx")}`);
  console.log(`    treasury  ${explorerUrl(ata, "address")}`);
}

/** Before touching a row: everything on-chain this plan needs is configured. */
function preflight(plan: DemoSeedPlan): void {
  const onChain = plan.kids.some((k) => k.createWallets) || (plan.treasury !== null && plan.treasury.mint > 0n);
  if (onChain) keypairFromEnv("FEE_PAYER_SECRET_KEY");
}

async function applyPlan(admin: SupabaseClient, plan: DemoSeedPlan, ata: string | null): Promise<void> {
  preflight(plan);
  const applied: Applied = { kidIds: new Map(), spendByKid: new Map() };
  for (const kid of plan.kids) await applyKid(admin, plan, kid, applied);
  await applyContacts(admin, plan, applied);
  await applyShopPay(admin, plan, applied);
  if (ata) await applyTreasury(plan, ata);
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
  const args = parseDemoSeedArgs(argv);
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
  if (cluster !== "devnet") throw new Error(`The demo seed is devnet only; NEXT_PUBLIC_SOLANA_CLUSTER is "${cluster}".`);
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");

  const now = new Date();
  const ref = await resolveFamilyRef(admin, args.family, USAGE);
  const snapshot = await loadSnapshot(admin, ref.familyId, parseTreasury(args.treasury) > 0n);
  const plan = planDemoSeed(snapshot, args, { now, guardianUserId: ref.guardianUserId });
  const ata = plan.treasury ? ataFor(plan.familyWallet.walletAddress).toBase58() : null;

  console.log(formatSeedPlan(plan, { dryRun: args.dryRun, ata }));
  console.log("");
  console.log(formatNextSteps(plan));
  if (args.dryRun) return 0;
  if (!args.yes) {
    const ok = await confirm(`\nApply this to "${plan.family.name}"? [y/N] `);
    if (!ok) {
      console.log(stdin.isTTY ? "Nothing changed." : "Nothing changed: stdin is not a terminal, pass --yes to run without the prompt.");
      return 1;
    }
  }

  console.log("");
  console.log("Applying:");
  try {
    await applyPlan(admin, plan, ata);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}\nThe seed is idempotent: fix the cause and run it again; whatever was saved is kept.`);
  }
  console.log('Done. New contacts are not on-chain yet: the guardian pushes them with "Update on-chain" on /family/rules once the kid\'s device is approved.');
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`demo-seed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
