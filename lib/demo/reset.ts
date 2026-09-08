/**
 * Demo reset, the pure half. Given a snapshot of one family's rows, decide
 * exactly which rows change so the guardian can run the demo again today:
 * a fresh sponsorship allowance, no stale requests or pending raises, and
 * expired pairing codes gone. Kids, wallets, contacts, allowances and every
 * past event stay put. No I/O here: scripts/demo-reset.ts loads the
 * snapshot, prints the plan, and applies it.
 */

import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";
import { SPONSORED_KINDS, SPONSORED_PER_DAY } from "@/lib/sponsor/policy";

export const USAGE = `Usage: npm run demo:reset -- --family <family id | guardian email> [--dry-run] [--topup <dollars>] [--yes]

  --family   The family to reset: families.id, or the sign-in email of one of its guardians.
  --dry-run  Print the plan and change nothing.
  --topup    Also mint this many test dollars to the family treasury (devnet only).
  --yes      Skip the confirmation prompt (needed when stdin is not a terminal).`;

export type DemoResetArgs = { family: string; dryRun: boolean; topup: string | null; yes: boolean; help: boolean };

function splitFlag(arg: string): { flag: string; inline: string | undefined } {
  const eq = arg.indexOf("=");
  return eq === -1 ? { flag: arg, inline: undefined } : { flag: arg.slice(0, eq), inline: arg.slice(eq + 1) };
}

/** `--family x --dry-run --topup 100`, with `--flag=value` accepted too. Throws with usage on bad input. */
export function parseDemoResetArgs(argv: readonly string[]): DemoResetArgs {
  const args: DemoResetArgs = { family: "", dryRun: false, topup: null, yes: false, help: false };
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
      case "--topup":
        args.topup = value().trim();
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
  return args;
}

/** The rows the planner looks at. Column names match the tables so the loader is a straight select. */
export type FamilySnapshot = {
  family: { id: string; name: string; timezone: string };
  guardians: Array<{ user_id: string; label: string; email: string | null }>;
  kids: Array<{ id: string; name: string }>;
  devices: Array<{ id: string; kid_id: string | null; user_id: string | null; status: string; pairing_expires_at: string | null }>;
  wallets: Array<{ id: string; kid_id: string | null; kind: string; wallet_address: string }>;
  limits: Array<{ id: string; kid_id: string | null; pending_raise: unknown }>;
  requests: Array<{ id: string; kid_id: string; type: string; status: string }>;
  /** Events by the family's members. The loader fetches from `since` on; the planner filters again. */
  events: Array<{ id: string; user_id: string; kind: string; created_at: string; sponsor_counted: boolean }>;
};

export type Member = { userId: string; who: string };

export type DemoResetPlan = {
  family: FamilySnapshot["family"];
  /** ISO instant: the start of the window countSponsoredToday counts from. */
  since: string;
  members: Member[];
  sponsor: { eventIds: string[]; perMember: Array<Member & { count: number }> };
  requests: { ids: string[]; perStatus: Record<string, number> };
  pendingRaises: { limitIds: string[]; who: string[] };
  expiredPairings: { deviceIds: string[] };
  topup: { dollars: string; units: bigint; walletAddress: string } | null;
};

export type PlanOptions = { now: Date; since: string; topup: string | null };

/** Everyone whose sponsored actions the cap counts: guardians, and the auth user behind each kid device. */
export function familyMembers(snapshot: FamilySnapshot): Member[] {
  const kidName = new Map(snapshot.kids.map((k) => [k.id, k.name]));
  const seen = new Map<string, string>();
  for (const g of snapshot.guardians) seen.set(g.user_id, g.email ? `${g.label} (${g.email})` : g.label);
  for (const d of snapshot.devices) {
    if (!d.user_id || !d.kid_id || seen.has(d.user_id)) continue;
    seen.set(d.user_id, `${kidName.get(d.kid_id) ?? "Kid"}'s device`);
  }
  return [...seen].map(([userId, who]) => ({ userId, who }));
}

function planTopup(snapshot: FamilySnapshot, dollars: string | null): DemoResetPlan["topup"] {
  if (dollars === null) return null;
  let units: bigint;
  try {
    units = dollarsToUnits(dollars);
  } catch {
    throw new Error(`--topup needs a dollar amount like 100 or 25.50, got "${dollars}".`);
  }
  if (units <= 0n) throw new Error("--topup must be above zero.");
  const treasury = snapshot.wallets.find((w) => w.kind === "family" && w.kid_id === null);
  if (!treasury) {
    throw new Error(`"${snapshot.family.name}" has no treasury wallet (wallets.kind = 'family'), so there is nothing to top up. The guardian creates it on the wallet page.`);
  }
  return { dollars: unitsToDisplay(units), units, walletAddress: treasury.wallet_address };
}

/** What would change. Pure: same snapshot and options, same plan. Throws only for a bad --topup. */
export function planDemoReset(snapshot: FamilySnapshot, options: PlanOptions): DemoResetPlan {
  const members = familyMembers(snapshot);
  const memberIds = new Set(members.map((m) => m.userId));
  const sponsoredKinds = new Set<string>(SPONSORED_KINDS);
  const sinceMs = Date.parse(options.since);
  const kidName = new Map(snapshot.kids.map((k) => [k.id, k.name]));

  // Exactly the rows countSponsoredToday would count right now, for every member.
  const counted = snapshot.events.filter((e) => e.sponsor_counted && sponsoredKinds.has(e.kind) && memberIds.has(e.user_id) && Date.parse(e.created_at) >= sinceMs);
  const perMember = members.map((m) => ({ ...m, count: counted.filter((e) => e.user_id === m.userId).length })).filter((m) => m.count > 0);

  const perStatus: Record<string, number> = {};
  for (const r of snapshot.requests) perStatus[r.status] = (perStatus[r.status] ?? 0) + 1;

  const raises = snapshot.limits.filter((l) => l.pending_raise !== null && l.pending_raise !== undefined);

  // Unclaimed codes past their time. A pending row with a user_id is a kid who has
  // joined and is waiting for the guardian's approval; that stays.
  const expired = snapshot.devices.filter(
    (d) => d.status === "pending" && d.user_id === null && d.pairing_expires_at !== null && Date.parse(d.pairing_expires_at) < options.now.getTime(),
  );

  return {
    family: snapshot.family,
    since: options.since,
    members,
    sponsor: { eventIds: counted.map((e) => e.id), perMember },
    requests: { ids: snapshot.requests.map((r) => r.id), perStatus },
    pendingRaises: { limitIds: raises.map((l) => l.id), who: raises.map((l) => (l.kid_id ? (kidName.get(l.kid_id) ?? "a kid") : "the guardian")) },
    expiredPairings: { deviceIds: expired.map((d) => d.id) },
    topup: planTopup(snapshot, options.topup),
  };
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** The plan as the operator reads it before saying yes. `ata` is the treasury token account, when known. */
export function formatPlan(plan: DemoResetPlan, view: { dryRun: boolean; ata: string | null }): string {
  const statuses = Object.entries(plan.requests.perStatus)
    .map(([status, n]) => `${status} ${n}`)
    .join(", ");
  const lines = [
    `Edventures Wallet demo reset${view.dryRun ? " (dry run: nothing changes)" : ""}`,
    `Family:  ${plan.family.name} (${plan.family.id}), timezone ${plan.family.timezone}`,
    `Members: ${plan.members.map((m) => m.who).join(", ") || "none"}`,
    `Window:  since ${plan.since} (the window countSponsoredToday uses)`,
    "",
    `1. Sponsor counter: mark ${count(plan.sponsor.eventIds.length, "event")} from today as not counted (cap ${SPONSORED_PER_DAY} a day; rows and signatures stay)`,
    ...plan.sponsor.perMember.map((m) => `     ${m.who}: ${m.count} counted today -> 0`),
    `2. Requests: delete ${count(plan.requests.ids.length, "row")}${statuses ? ` (${statuses})` : ""}`,
    `3. Pending raises: clear on ${count(plan.pendingRaises.limitIds.length, "limits row")}${plan.pendingRaises.who.length ? ` (${plan.pendingRaises.who.join(", ")})` : ""}`,
    `4. Expired pairing codes: delete ${count(plan.expiredPairings.deviceIds.length, "unclaimed device row")}`,
    plan.topup
      ? `5. Top-up: mint ${plan.topup.dollars} of test USDC to the family treasury ${plan.topup.walletAddress}${view.ata ? ` (token account ${view.ata})` : ""}`
      : "5. Top-up: none (pass --topup <dollars> to mint test USDC to the treasury)",
    "",
    "Leaves alone: kids, wallets, contacts, allowances, savings goals, active and joined devices, and every past event with its on-chain signature.",
  ];
  return lines.join("\n");
}
