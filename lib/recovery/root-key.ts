/**
 * Moving a family onto a new root key, the pure half. Every Swig a family
 * owns (the treasury and each kid's three jars) has one root: the guardian's
 * device key. When that browser is gone the key is gone, and nothing on
 * those wallets can be signed again. The only way forward is fresh wallets
 * with the guardian's current device key as root, the same rows pointing
 * at them, and the roles that root had granted (the keeper, each kid's
 * device) granted again from the app. Devnet only: the balances are minted
 * back, they do not move.
 *
 * No I/O here: scripts/move-root-key.ts loads the snapshot (rows plus each
 * wallet's on-chain root), prints the plan, and applies it.
 */

import { unitsToDisplay } from "@/lib/money/usdc";

export const USAGE = `Usage: npm run recover:root-key -- --family <family id | guardian email> --to <device pubkey> [--dry-run] [--yes]

  --family   The family to move: families.id, or the sign-in email of one of its guardians.
  --to       The guardian's current device key (Settings shows it as "Key FTLe…QaTm"; pass the full key).
             It must already be registered: open Settings on that browser first.
  --dry-run  Print the plan and change nothing.
  --yes      Skip the confirmation prompt (needed when stdin is not a terminal).`;

export type RootMoveArgs = { family: string; to: string; dryRun: boolean; yes: boolean; help: boolean };

function splitFlag(arg: string): { flag: string; inline: string | undefined } {
  const eq = arg.indexOf("=");
  return eq === -1 ? { flag: arg, inline: undefined } : { flag: arg.slice(0, eq), inline: arg.slice(eq + 1) };
}

/** `--family x --to <pubkey> --dry-run`, with `--flag=value` accepted too. Throws with usage on bad input. */
export function parseRootMoveArgs(argv: readonly string[]): RootMoveArgs {
  const args: RootMoveArgs = { family: "", to: "", dryRun: false, yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const { flag, inline } = splitFlag(argv[i]);
    const value = (): string => {
      const v = inline ?? argv[++i];
      if (v === undefined || v.startsWith("-")) throw new Error(`${flag} needs a value.\n\n${USAGE}`);
      return v;
    };
    switch (flag) {
      case "--family":
        args.family = value().trim();
        break;
      case "--to":
        args.to = value().trim();
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--yes":
        args.yes = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown option ${argv[i]}.\n\n${USAGE}`);
    }
  }
  if (!args.help && !args.family) throw new Error(`--family is required.\n\n${USAGE}`);
  if (!args.help && !args.to) throw new Error(`--to is required.\n\n${USAGE}`);
  return args;
}

/** The rows the planner looks at, plus what the chain says each wallet's root is. */
export type RootMoveSnapshot = {
  family: { id: string; name: string; keeper_role_id: number | null };
  guardians: Array<{ user_id: string }>;
  kids: Array<{ id: string; name: string }>;
  devices: Array<{ id: string; user_id: string | null; kid_id: string | null; pubkey: string; status: string }>;
  wallets: Array<{
    id: string;
    kid_id: string | null;
    kind: string;
    swig_address: string;
    wallet_address: string;
    /** The ed25519 root authority read from the Swig on-chain. */
    rootPubkey: string;
    /** Test-dollar balance to mint back after the move. */
    balanceUnits: bigint;
  }>;
  contacts: Array<{ id: string; kid_id: string; address: string }>;
};

export type RootMovePlan = {
  family: RootMoveSnapshot["family"];
  /** The registered device row that holds the new root key, and the guardian it belongs to. */
  newDevice: { id: string; pubkey: string; userId: string };
  /** The guardian's other device rows, still marked active though their keys are gone; they are revoked. */
  retireDeviceIds: string[];
  /** Every wallet whose on-chain root is not the new key: recreated with the new key as root. */
  wallets: Array<{ id: string; who: string; kind: string; oldWalletAddress: string; balanceUnits: bigint }>;
  /** Contacts whose address is one of the wallets being recreated; rewritten once the new addresses exist. */
  contacts: Array<{ id: string; oldAddress: string }>;
  /** Kid devices that held a role on the old wallets; back to pending so the guardian approves them again. */
  reapproveDevices: Array<{ id: string; kidName: string }>;
  /** The keeper role lived on the old treasury; it is switched off and the guardian turns it on again. */
  keeperWasOn: boolean;
};

function whoOwns(wallet: { kid_id: string | null; kind: string }, kids: RootMoveSnapshot["kids"]): string {
  if (!wallet.kid_id) return "the family wallet";
  const kid = kids.find((k) => k.id === wallet.kid_id);
  return `${kid?.name ?? "a kid"}'s ${wallet.kind}`;
}

/**
 * Decide what moves. Throws when the new key is not a registered device of
 * one of the family's guardians, or when every wallet already has it as root.
 */
export function planRootMove(snapshot: RootMoveSnapshot, input: { toPubkey: string }): RootMovePlan {
  const guardianIds = new Set(snapshot.guardians.map((g) => g.user_id));
  const newDevice = snapshot.devices.find((d) => d.pubkey === input.toPubkey && d.kid_id === null);
  if (!newDevice) throw new Error(`No registered device has the key ${input.toPubkey}. Open Settings on that browser first, then run again.`);
  if (!newDevice.user_id || !guardianIds.has(newDevice.user_id)) throw new Error(`The device with key ${input.toPubkey} does not belong to a guardian of "${snapshot.family.name}".`);

  const wallets = snapshot.wallets.filter((w) => w.rootPubkey !== input.toPubkey);
  if (wallets.length === 0) throw new Error(`Every wallet of "${snapshot.family.name}" already has ${input.toPubkey} as root. Nothing to move.`);

  const oldAddresses = new Set(wallets.map((w) => w.wallet_address));
  return {
    family: snapshot.family,
    newDevice: { id: newDevice.id, pubkey: newDevice.pubkey, userId: newDevice.user_id },
    retireDeviceIds: snapshot.devices.filter((d) => d.kid_id === null && d.user_id === newDevice.user_id && d.id !== newDevice.id && d.status === "active").map((d) => d.id),
    wallets: wallets.map((w) => ({ id: w.id, who: whoOwns(w, snapshot.kids), kind: w.kind, oldWalletAddress: w.wallet_address, balanceUnits: w.balanceUnits })),
    contacts: snapshot.contacts.filter((c) => oldAddresses.has(c.address)).map((c) => ({ id: c.id, oldAddress: c.address })),
    reapproveDevices: snapshot.devices
      .filter((d) => d.kid_id !== null && d.user_id && d.status === "active")
      .map((d) => ({ id: d.id, kidName: snapshot.kids.find((k) => k.id === d.kid_id)?.name ?? "a kid" })),
    keeperWasOn: snapshot.family.keeper_role_id !== null,
  };
}

const short = (key: string) => `${key.slice(0, 4)}…${key.slice(-4)}`;

export function formatPlan(plan: RootMovePlan, opts: { dryRun: boolean }): string {
  const lines = [
    `${opts.dryRun ? "Dry run for" : "Plan for"} "${plan.family.name}" (${plan.family.id})`,
    `  New root key: ${short(plan.newDevice.pubkey)} (device ${plan.newDevice.id})`,
    "",
    `  Wallets recreated on Solana with the new root (${plan.wallets.length}):`,
    ...plan.wallets.map((w) => `    ${w.who}: ${short(w.oldWalletAddress)} → new, then ${unitsToDisplay(w.balanceUnits)} minted back`),
    `  Contacts pointed at the new addresses: ${plan.contacts.length}`,
    `  Old guardian devices revoked: ${plan.retireDeviceIds.length}`,
    `  Kid devices back to pending, for approval again in Family: ${plan.reapproveDevices.length === 0 ? "none" : plan.reapproveDevices.map((d) => d.kidName).join(", ")}`,
    `  Automatic allowance: ${plan.keeperWasOn ? "was on; switched off, turn it on again in Allowance" : "was off; nothing to do"}`,
    "",
    "  Money on the old wallets stays there: the only key that could move it is gone. The same amounts are minted to the new ones.",
  ];
  return lines.join("\n");
}
