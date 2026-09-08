// Move a family onto a new root key after the guardian's device key is gone.
// Every Swig the old key rooted (the treasury, each kid's three jars) is
// recreated with the new key as root, the same wallet rows point at the new
// addresses, contacts follow, and what the old root had granted (the keeper
// role, each kid's device role) is reset so the guardian grants it again from
// the app. Devnet only: balances are minted back, they do not move. The
// planning logic is pure and lives in lib/recovery/root-key.ts; this file is
// the I/O around it.
//
//   npm run recover:root-key -- --family <family id | guardian email> --to <device pubkey> --dry-run
//   npm run recover:root-key -- --family <family id | guardian email> --to <device pubkey> [--yes]

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PublicKey } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveFamilyRef } from "@/lib/demo/family-ref";
import { ataFor } from "@/lib/family/onchain";
import { unitsToDisplay } from "@/lib/money/usdc";
import { formatPlan, parseRootMoveArgs, planRootMove, USAGE, type RootMovePlan, type RootMoveSnapshot } from "@/lib/recovery/root-key";
import { getConnection } from "@/lib/solana/connection";
import { explorerUrl } from "@/lib/solana/explorer";
import { keypairFromEnv } from "@/lib/solana/keys";
import { mintDollarsTo } from "@/lib/solana/mint";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createWallet, loadWallet } from "@/lib/swig/wallet";

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

/** The Swig's first ed25519 authority: the root the wallet was created with. */
async function rootPubkeyOf(swigAddress: string): Promise<string> {
  const swig = await loadWallet(getConnection(), new PublicKey(swigAddress));
  const root = swig.roles.find((r) => r.id === 0) ?? swig.roles[0];
  if (!root) throw new Error(`Swig ${swigAddress} has no roles`);
  return new PublicKey(root.authority.signer).toBase58();
}

async function balanceOf(walletAddress: string): Promise<bigint> {
  return getAccount(getConnection(), ataFor(walletAddress))
    .then((a) => a.amount)
    .catch(() => 0n);
}

async function loadSnapshot(admin: SupabaseClient, familyId: string): Promise<RootMoveSnapshot> {
  const familyRes = await admin.from("families").select("id,name,keeper_role_id").eq("id", familyId).single();
  check("families", familyRes.error);
  const byFamily = (table: string, columns: string) => admin.from(table).select(columns).eq("family_id", familyId);

  const guardians = rows<RootMoveSnapshot["guardians"][number]>("guardians", await byFamily("guardians", "user_id"));
  const kids = rows<RootMoveSnapshot["kids"][number]>("kids", await byFamily("kids", "id,name"));
  // A guardian's own device rows may predate the family (no family_id yet), so load them by user too.
  const familyDevices = rows<RootMoveSnapshot["devices"][number]>("devices", await byFamily("devices", "id,user_id,kid_id,pubkey,status"));
  const guardianDevices = rows<RootMoveSnapshot["devices"][number]>(
    "devices",
    await admin.from("devices").select("id,user_id,kid_id,pubkey,status").in("user_id", guardians.map((g) => g.user_id)).is("kid_id", null),
  );
  const devices = [...familyDevices, ...guardianDevices.filter((d) => !familyDevices.some((f) => f.id === d.id))];
  const walletRows = rows<{ id: string; kid_id: string | null; kind: string; swig_address: string; wallet_address: string }>("wallets", await byFamily("wallets", "id,kid_id,kind,swig_address,wallet_address"));
  const contacts = rows<RootMoveSnapshot["contacts"][number]>("contacts", await byFamily("contacts", "id,kid_id,address"));

  const wallets = await Promise.all(walletRows.map(async (w) => ({ ...w, rootPubkey: await rootPubkeyOf(w.swig_address), balanceUnits: await balanceOf(w.wallet_address) })));
  return { family: familyRes.data as RootMoveSnapshot["family"], guardians, kids, devices, wallets, contacts };
}

// --- Apply ------------------------------------------------------------------

async function applyStep(step: string, run: () => PromiseLike<DbResult>): Promise<void> {
  const res = await run();
  check(step, res.error);
  const changed = ((res.data as unknown[] | null) ?? []).length;
  console.log(`  ${step}: ${changed} row${changed === 1 ? "" : "s"}`);
}

async function applyPlan(admin: SupabaseClient, plan: RootMovePlan): Promise<void> {
  const connection = getConnection();
  const payer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const root = new PublicKey(plan.newDevice.pubkey);

  // Chain first: a new Swig per wallet. Nothing in the database changes until every one exists.
  const created: Array<{ id: string; who: string; oldWalletAddress: string; swigAddress: string; walletAddress: string; signature: string; balanceUnits: bigint }> = [];
  for (const w of plan.wallets) {
    const c = await createWallet({ connection, payer, root });
    created.push({ ...w, swigAddress: c.swigAddress.toBase58(), walletAddress: c.walletAddress.toBase58(), signature: c.signature });
    console.log(`  ${w.who}: new wallet ${c.walletAddress.toBase58()}`);
    console.log(`    tx  ${explorerUrl(c.signature, "tx")}`);
  }

  console.log("Saving:");
  for (const c of created) {
    await applyStep(`wallet row (${c.who})`, () => admin.from("wallets").update({ swig_address: c.swigAddress, wallet_address: c.walletAddress, root_device_id: plan.newDevice.id }).eq("id", c.id).select("id"));
  }
  for (const c of created) {
    const ids = plan.contacts.filter((x) => x.oldAddress === c.oldWalletAddress).map((x) => x.id);
    if (ids.length === 0) continue;
    await applyStep(`contacts pointing at ${c.who}`, () => admin.from("contacts").update({ address: c.walletAddress, onchain_synced: false }).in("id", ids).select("id"));
  }
  await applyStep("contacts marked for re-sync", () => admin.from("contacts").update({ onchain_synced: false }).eq("family_id", plan.family.id).select("id"));
  await applyStep("limits marked for re-sync", () => admin.from("limits").update({ onchain_synced: false }).eq("family_id", plan.family.id).select("id"));
  if (plan.reapproveDevices.length > 0) {
    const ids = plan.reapproveDevices.map((d) => d.id);
    await applyStep("kid devices back to pending", () => admin.from("devices").update({ status: "pending", role_id: null }).in("id", ids).select("id"));
  }
  if (plan.retireDeviceIds.length > 0) {
    await applyStep("old guardian devices revoked", () => admin.from("devices").update({ status: "revoked", label: "Lost device" }).in("id", plan.retireDeviceIds).select("id"));
  }
  await applyStep("new device joined to the family", () => admin.from("devices").update({ family_id: plan.family.id }).eq("id", plan.newDevice.id).select("id"));
  if (plan.keeperWasOn) {
    await applyStep("automatic allowance switched off", () => admin.from("families").update({ keeper_role_id: null }).eq("id", plan.family.id).select("id"));
  }
  const treasury = created.find((c) => c.who === "the family wallet");
  await applyStep(
    "event",
    () =>
      admin
        .from("events")
        .insert({
          user_id: plan.newDevice.userId,
          family_id: plan.family.id,
          kind: "wallet_created",
          signature: treasury?.signature ?? created[0].signature,
          summary: "Your wallets moved to this device's key",
        })
        .select("id"),
  );

  // The rows and the chain agree from here on; a mint that fails (devnet rate limits) is reported, not fatal.
  console.log("Minting back:");
  const unminted: string[] = [];
  for (const c of created) {
    if (c.balanceUnits === 0n) continue;
    try {
      const signature = await mintDollarsTo(new PublicKey(c.walletAddress), c.balanceUnits);
      console.log(`  ${c.who}: ${unitsToDisplay(c.balanceUnits)}  ${explorerUrl(signature, "tx")}`);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : String(error);
      console.log(`  ${c.who}: FAILED (${message}). Mint ${unitsToDisplay(c.balanceUnits)} to ${c.walletAddress} by hand.`);
      unminted.push(c.who);
    }
  }
  if (unminted.length > 0) console.log(`Not minted: ${unminted.join(", ")}. Everything else is done; only those balances are missing.`);
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
  const args = parseRootMoveArgs(argv);
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
  if (cluster !== "devnet") throw new Error(`Moving a root key is devnet only for now; NEXT_PUBLIC_SOLANA_CLUSTER is "${cluster}".`);
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");

  const { familyId } = await resolveFamilyRef(admin, args.family, USAGE);
  const snapshot = await loadSnapshot(admin, familyId);
  const plan = planRootMove(snapshot, { toPubkey: args.to });

  console.log(formatPlan(plan, { dryRun: args.dryRun }));
  if (args.dryRun) return 0;
  if (!args.yes) {
    const ok = await confirm(`\nApply this to "${plan.family.name}"? [y/N] `);
    if (!ok) {
      console.log(stdin.isTTY ? "Nothing changed." : "Nothing changed: stdin is not a terminal, pass --yes to run without the prompt.");
      return 1;
    }
  }

  console.log("");
  console.log("Creating on Solana:");
  await applyPlan(admin, plan);
  console.log("Done. Next, from the new device: approve each kid's device again in Family, and turn automatic allowance back on.");
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`move-root-key: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
