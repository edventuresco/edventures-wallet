/**
 * Demo seed, the pure half. Given a snapshot of one family's rows and the
 * operator's wishes, decide exactly what to add so the family is ready for a
 * demo: kids with their three wallets, limits and allowance (the same rows
 * app/family/actions.ts addKid writes), people on every kid's list, a funded
 * treasury and "Pay a shop" on. Everything that exists is kept, never
 * duplicated. No I/O here: scripts/demo-seed.ts loads the snapshot, prints
 * the plan, and applies it.
 */

import { AVATARS } from "@/lib/avatars";
import { DEFAULTS } from "@/lib/family/defaults";
import { dollarsToUnits, unitsToDisplay } from "@/lib/money/usdc";
import { ageFromBirth, defaultAllowanceUnits, nextMondayAt } from "@/lib/rules/allowance";
import { validateNewContact } from "@/lib/rules/contacts";
import { DEFAULT_CONTACT_WEEKLY_UNITS } from "@/lib/rules/limits";

export const USAGE = `Usage: npm run demo:seed -- --family <family id | guardian email> [options]

  --family     The family to seed: families.id, or the sign-in email of one of its guardians.
  --kids       Kids to create as Name:birthYear, comma-separated: "Ten:2016,Eight:2018". A kid that exists by name is kept.
  --contacts   People for every kid's list as Label:address, comma-separated: "Grandma:<address>,Friend:<address>".
  --zara       Address for a "Zara" contact with a $2.00 weekly cap on every kid's list (the blocked send in the demo).
  --treasury   Mint test USDC until the family wallet holds at least this many dollars (default 100; 0 leaves it alone).
  --shop-pay   Switch "Pay a shop" on for every kid.
  --dry-run    Print the plan and change nothing.
  --yes        Skip the confirmation prompt (needed when stdin is not a terminal).`;

/** Seeded kids are born in January; only the year is asked for. */
export const SEED_BIRTH_MONTH = 1;
export const DEFAULT_TREASURY_DOLLARS = "100";
/** Zara's cap: small enough that the demo's send to her is blocked. */
export const ZARA_WEEKLY_UNITS = dollarsToUnits("2");
export const ZARA_LABEL = "Zara";
export const CONTACT_AVATAR_ID = "person";
export const PARENT_AVATAR_ID = "parent";
/** The animal set in picker order (lib/avatars); new kids cycle through it. */
export const ANIMAL_AVATAR_IDS: readonly string[] = AVATARS.filter((a) => a.kind === "emoji").map((a) => a.id);

const WALLET_KINDS = ["spend", "save", "share"] as const;

export type KidSpec = { name: string; birthYear: number };
export type ContactSpec = { label: string; address: string };

export type DemoSeedArgs = {
  family: string;
  kids: KidSpec[];
  contacts: ContactSpec[];
  zara: string | null;
  /** Dollars the treasury should hold after the seed; "0" leaves it alone. */
  treasury: string;
  shopPay: boolean;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
};

// --- Arguments -----------------------------------------------------------------

const norm = (s: string): string => s.trim().toLowerCase();

function splitFlag(arg: string): { flag: string; inline: string | undefined } {
  const eq = arg.indexOf("=");
  return eq === -1 ? { flag: arg, inline: undefined } : { flag: arg.slice(0, eq), inline: arg.slice(eq + 1) };
}

function splitLast(entry: string, sep: string): [string, string] | null {
  const i = entry.lastIndexOf(sep);
  return i === -1 ? null : [entry.slice(0, i).trim(), entry.slice(i + 1).trim()];
}

const listOf = (value: string): string[] =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** `"Ten:2016,Eight:2018"` → kid specs. Names are unique (case-insensitive); years fit kids.birth_year. */
export function parseKids(value: string): KidSpec[] {
  const out: KidSpec[] = [];
  for (const entry of listOf(value)) {
    const pair = splitLast(entry, ":");
    if (!pair || !pair[0] || !/^\d{4}$/.test(pair[1])) throw new Error(`--kids entries look like Name:birthYear, got "${entry}".\n\n${USAGE}`);
    const [name, year] = pair;
    const birthYear = Number(year);
    if (birthYear < 2000 || birthYear > 2030) throw new Error(`--kids: ${name}'s birth year must be between 2000 and 2030 (kids.birth_year), got ${birthYear}.`);
    const dup = out.find((k) => norm(k.name) === norm(name));
    if (dup) throw new Error(`--kids names ${dup.name} twice.`);
    out.push({ name, birthYear });
  }
  return out;
}

/** "50.00" from units: the form validateNewContact reads. */
const weeklyDollars = (units: bigint): string => unitsToDisplay(units).replace(/[$,]/g, "");

/** Same checks the guardian's "add someone" form applies (lib/rules/contacts). */
function checkContact(flag: string, label: string, address: string, weeklyUnits: bigint): ContactSpec {
  const check = validateNewContact({ label, avatarId: CONTACT_AVATAR_ID, address, weeklyDollars: weeklyDollars(weeklyUnits) });
  if (!check.ok) throw new Error(`${flag} (${label || "?"}: ${address || "?"}): ${check.error}`);
  return { label: check.contact.label, address: check.contact.address };
}

/** `"Grandma:<address>,Friend:<address>"` → contact specs. Addresses are unique. */
export function parseContacts(value: string): ContactSpec[] {
  const out: ContactSpec[] = [];
  for (const entry of listOf(value)) {
    const pair = splitLast(entry, ":");
    if (!pair) throw new Error(`--contacts entries look like Label:address, got "${entry}".\n\n${USAGE}`);
    const contact = checkContact("--contacts", pair[0], pair[1], DEFAULT_CONTACT_WEEKLY_UNITS);
    if (out.some((c) => c.address === contact.address)) throw new Error(`--contacts lists ${contact.address} twice.`);
    out.push(contact);
  }
  return out;
}

/** `--family x --kids "Ten:2016" --contacts "Grandma:addr" --zara addr --treasury 100 --shop-pay`, with `--flag=value` accepted too. Throws with usage on bad input. */
export function parseDemoSeedArgs(argv: readonly string[]): DemoSeedArgs {
  const args: DemoSeedArgs = { family: "", kids: [], contacts: [], zara: null, treasury: DEFAULT_TREASURY_DOLLARS, shopPay: false, dryRun: false, yes: false, help: false };
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
      case "--kids":
        args.kids = parseKids(value());
        break;
      case "--contacts":
        args.contacts = parseContacts(value());
        break;
      case "--zara":
        args.zara = checkContact("--zara", ZARA_LABEL, value(), ZARA_WEEKLY_UNITS).address;
        break;
      case "--treasury":
        args.treasury = value().trim();
        break;
      case "--shop-pay":
        args.shopPay = true;
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
  if (args.help) return args;
  if (!args.family) throw new Error(`--family is required.\n\n${USAGE}`);
  if (args.zara && args.contacts.some((c) => c.address === args.zara)) throw new Error(`--zara is already in --contacts (${args.zara}); pick one.`);
  return args;
}

// --- Snapshot and plan -------------------------------------------------------------

/** The rows the planner looks at. Column names match the tables so the loader is a straight select. */
export type SeedSnapshot = {
  /** keeper_role_id is undefined until the keeper migration is applied; null when the keeper is off. */
  family: { id: string; name: string; timezone: string; keeper_role_id?: number | null };
  guardians: Array<{ user_id: string; label: string; email: string | null }>;
  devices: Array<{ id: string; kid_id: string | null; user_id: string | null; status: string; pubkey: string }>;
  /** shop_pay_enabled is undefined until the shop-pay migration is applied. In created_at order. */
  kids: Array<{ id: string; name: string; avatar_id: string; birth_month: number | null; birth_year: number | null; shop_pay_enabled?: boolean }>;
  wallets: Array<{ id: string; kid_id: string | null; kind: string; wallet_address: string }>;
  contacts: Array<{ id: string; kid_id: string; label: string; address: string; status: string; onchain_synced: boolean }>;
  limits: Array<{ id: string; kid_id: string | null }>;
  allowances: Array<{ id: string; kid_id: string }>;
  invites: Array<{ kid_id: string; email: string; created_at: string; accepted_at: string | null }>;
  /** What the family wallet's token account holds now; 0n when the account does not exist yet. Null when not read. */
  treasuryUnits: bigint | null;
};

export type DeviceStatus = "none" | "pending" | "active";

export type KidPlan = {
  name: string;
  /** kids.id when the row exists; null until the seed inserts it. */
  id: string | null;
  avatarId: string;
  birthMonth: number | null;
  birthYear: number | null;
  age: number | null;
  /** Insert the kids row. */
  create: boolean;
  /** Create the three Swig wallets on Solana and their rows (plus the wallet_created event). */
  createWallets: boolean;
  createLimits: boolean;
  /** Amount for a new allowances row; null keeps the one that exists. */
  allowanceUnits: bigint | null;
  /** Set kids.shop_pay_enabled = true. */
  shopPayOn: boolean;
  /** The newest invite sent for this kid. */
  invite: { email: string; accepted: boolean } | null;
  device: DeviceStatus;
  /** Active contacts that will not be on-chain after the seed (existing unsynced plus the rows added now). */
  contactsToSync: number;
};

/** A destination the applier fills in: a known wallet address, or the spend wallet of a kid whose wallets this run creates. */
export type AddressRef = { address: string } | { spendOf: string };

export type ContactPlan = {
  kidName: string;
  label: string;
  avatarId: string;
  to: AddressRef;
  weeklyUnits: bigint;
  why: "family" | "sibling" | "contact" | "zara";
  /** contacts.id of a removed row at this address to bring back (like addContact does) instead of inserting. */
  reactivateId: string | null;
};

export type SkippedContact = { kidName: string; label: string; reason: string };

export type DemoSeedPlan = {
  family: { id: string; name: string; timezone: string };
  /** The guardian whose device is the root of every kid wallet (and whose label names the family-wallet contact). */
  guardian: { userId: string; label: string; email: string | null };
  root: { deviceId: string; pubkey: string };
  familyWallet: { walletAddress: string };
  /** next_run_at for every new allowances row: the coming Monday 09:00, as addKid computes it. */
  allowanceNextRunAt: Date;
  /** Every kid the family will have: existing first (snapshot order), then the new ones. */
  kids: KidPlan[];
  contacts: { rows: ContactPlan[]; skipped: SkippedContact[] };
  treasury: { target: bigint; held: bigint; mint: bigint } | null;
  /** --shop-pay was asked for; which kids it reaches is on each KidPlan. */
  shopPay: boolean;
  keeper: "on" | "off" | "unknown";
};

export type PlanOptions = {
  now: Date;
  /** When --family was an email: that guardian must hold the root device. Null: any guardian with one. */
  guardianUserId: string | null;
};

/** Animal avatars for `count` new kids, in picker order, skipping the ones the family already uses; cycles when they run out. */
export function nextAvatars(taken: Iterable<string>, count: number): string[] {
  const used = new Set(taken);
  const free = ANIMAL_AVATAR_IDS.filter((id) => !used.has(id));
  const pool = free.length > 0 ? free : ANIMAL_AVATAR_IDS;
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

function pickRoot(snapshot: SeedSnapshot, guardianUserId: string | null): { guardian: DemoSeedPlan["guardian"]; root: DemoSeedPlan["root"] } {
  const candidates = guardianUserId ? snapshot.guardians.filter((g) => g.user_id === guardianUserId) : snapshot.guardians;
  for (const g of candidates) {
    const device = snapshot.devices.find((d) => d.user_id === g.user_id && d.kid_id === null && d.status === "active");
    if (device) return { guardian: { userId: g.user_id, label: g.label, email: g.email }, root: { deviceId: device.id, pubkey: device.pubkey } };
  }
  const who = guardianUserId ? `${candidates[0]?.email ?? "That guardian"} has no registered device` : `No guardian of "${snapshot.family.name}" has a registered device`;
  throw new Error(`${who} (devices: user_id = guardian, kid_id null, status active). Set up the device on the wallet page first; it becomes the root of every kid wallet.`);
}

function deviceStatus(devices: SeedSnapshot["devices"], kidId: string): DeviceStatus {
  const mine = devices.filter((d) => d.kid_id === kidId);
  if (mine.some((d) => d.status === "active")) return "active";
  if (mine.some((d) => d.status === "pending")) return "pending";
  return "none";
}

function newestInvite(invites: SeedSnapshot["invites"], kidId: string): KidPlan["invite"] {
  const mine = invites.filter((i) => i.kid_id === kidId).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return mine[0] ? { email: mine[0].email, accepted: Boolean(mine[0].accepted_at) } : null;
}

function planExistingKid(snapshot: SeedSnapshot, kid: SeedSnapshot["kids"][number], now: Date, shopPay: boolean): KidPlan {
  const have = WALLET_KINDS.filter((kind) => snapshot.wallets.some((w) => w.kid_id === kid.id && w.kind === kind));
  if (have.length !== 0 && have.length !== WALLET_KINDS.length) {
    throw new Error(`${kid.name} has ${have.length} of ${WALLET_KINDS.length} wallets (${have.join(", ")}). Fix that by hand before seeding.`);
  }
  if (shopPay && kid.shop_pay_enabled === undefined) {
    throw new Error("kids.shop_pay_enabled does not exist yet, so --shop-pay cannot be applied. Apply supabase/migrations/20260907110000_kid_shop_pay.sql first.");
  }
  const age = ageFromBirth(kid.birth_month, kid.birth_year, now);
  return {
    name: kid.name,
    id: kid.id,
    avatarId: kid.avatar_id,
    birthMonth: kid.birth_month,
    birthYear: kid.birth_year,
    age,
    create: false,
    createWallets: have.length === 0,
    createLimits: !snapshot.limits.some((l) => l.kid_id === kid.id),
    allowanceUnits: snapshot.allowances.some((a) => a.kid_id === kid.id) ? null : defaultAllowanceUnits(age),
    shopPayOn: shopPay && kid.shop_pay_enabled !== true,
    invite: newestInvite(snapshot.invites, kid.id),
    device: deviceStatus(snapshot.devices, kid.id),
    contactsToSync: 0,
  };
}

function planNewKid(spec: KidSpec, avatarId: string, now: Date, shopPay: boolean): KidPlan {
  const age = ageFromBirth(SEED_BIRTH_MONTH, spec.birthYear, now);
  return {
    name: spec.name,
    id: null,
    avatarId,
    birthMonth: SEED_BIRTH_MONTH,
    birthYear: spec.birthYear,
    age,
    create: true,
    createWallets: true,
    createLimits: true,
    allowanceUnits: defaultAllowanceUnits(age),
    shopPayOn: shopPay,
    invite: null,
    device: "none",
    contactsToSync: 0,
  };
}

type Wanted = Omit<ContactPlan, "kidName" | "reactivateId">;

/** Everyone a kid's list should hold, in the order addKid and the flags add them: the family wallet, each sibling, --contacts, Zara. */
function wantedFor(kid: KidPlan, plan: Pick<DemoSeedPlan, "guardian" | "familyWallet" | "kids">, snapshot: SeedSnapshot, args: DemoSeedArgs): Wanted[] {
  const perContact = DEFAULTS.perContactWeeklyUnits;
  const spendOf = (sibling: KidPlan): AddressRef => {
    const existing = sibling.id ? snapshot.wallets.find((w) => w.kid_id === sibling.id && w.kind === "spend") : undefined;
    return existing ? { address: existing.wallet_address } : { spendOf: sibling.name };
  };
  return [
    { label: plan.guardian.label === "Guardian" ? "Guardian" : "Mum", avatarId: PARENT_AVATAR_ID, to: { address: plan.familyWallet.walletAddress }, weeklyUnits: perContact, why: "family" },
    ...plan.kids.filter((s) => s !== kid).map((s): Wanted => ({ label: s.name, avatarId: s.avatarId, to: spendOf(s), weeklyUnits: perContact, why: "sibling" })),
    ...args.contacts.map((c): Wanted => ({ label: c.label, avatarId: CONTACT_AVATAR_ID, to: { address: c.address }, weeklyUnits: DEFAULT_CONTACT_WEEKLY_UNITS, why: "contact" })),
    ...(args.zara ? [{ label: ZARA_LABEL, avatarId: CONTACT_AVATAR_ID, to: { address: args.zara }, weeklyUnits: ZARA_WEEKLY_UNITS, why: "zara" } as Wanted] : []),
  ];
}

function planContacts(plan: Pick<DemoSeedPlan, "guardian" | "familyWallet" | "kids">, snapshot: SeedSnapshot, args: DemoSeedArgs): DemoSeedPlan["contacts"] {
  const rows: ContactPlan[] = [];
  const skipped: SkippedContact[] = [];
  for (const kid of plan.kids) {
    const seen = new Map<string, string>();
    for (const want of wantedFor(kid, plan, snapshot, args)) {
      const known = "address" in want.to ? want.to.address : null;
      const key = "address" in want.to ? want.to.address : `spend:${norm(want.to.spendOf)}`;
      const earlier = seen.get(key);
      if (earlier !== undefined) {
        skipped.push({ kidName: kid.name, label: want.label, reason: `same address as ${earlier}` });
        continue;
      }
      seen.set(key, want.label);
      const existing = kid.id && known ? snapshot.contacts.find((c) => c.kid_id === kid.id && c.address === known) : undefined;
      if (existing && existing.status !== "removed") {
        skipped.push({ kidName: kid.name, label: want.label, reason: `already on the list as ${existing.label}${existing.status === "active" ? "" : ` (${existing.status})`}` });
        continue;
      }
      rows.push({ kidName: kid.name, ...want, reactivateId: existing?.id ?? null });
    }
  }
  return { rows, skipped };
}

/** `--treasury` in base units; 0n means leave the treasury alone (so the loader need not read it). */
export function parseTreasury(dollars: string): bigint {
  try {
    return dollarsToUnits(dollars);
  } catch {
    throw new Error(`--treasury needs a dollar amount like 100 or 25.50, got "${dollars}".`);
  }
}

function planTreasury(snapshot: SeedSnapshot, dollars: string): DemoSeedPlan["treasury"] {
  const target = parseTreasury(dollars);
  if (target === 0n) return null;
  if (snapshot.treasuryUnits === null) throw new Error("planDemoSeed: the treasury balance was not read, so --treasury cannot be planned.");
  const held = snapshot.treasuryUnits;
  return { target, held, mint: target > held ? target - held : 0n };
}

/** What would change. Pure: same snapshot, arguments and options, same plan. Throws when the family cannot be seeded or an argument is bad. */
export function planDemoSeed(snapshot: SeedSnapshot, args: DemoSeedArgs, options: PlanOptions): DemoSeedPlan {
  const { guardian, root } = pickRoot(snapshot, options.guardianUserId);
  const treasuryWallet = snapshot.wallets.find((w) => w.kind === "family" && w.kid_id === null);
  if (!treasuryWallet) {
    throw new Error(`"${snapshot.family.name}" has no family wallet (wallets.kind = 'family'). The guardian creates their wallet on the wallet page; it becomes the family wallet and the treasury.`);
  }
  const familyWallet = { walletAddress: treasuryWallet.wallet_address };

  const existing = snapshot.kids.map((k) => planExistingKid(snapshot, k, options.now, args.shopPay));
  const existingNames = new Set<string>();
  for (const k of existing) {
    // The plan keys kids by name (sibling contacts, new wallets), so two kids with one name cannot be told apart.
    if (existingNames.has(norm(k.name))) throw new Error(`"${snapshot.family.name}" has two kids named ${k.name}; rename one in the app before seeding.`);
    existingNames.add(norm(k.name));
  }
  const fresh = args.kids.filter((spec) => !existingNames.has(norm(spec.name)));
  const avatars = nextAvatars(existing.map((k) => k.avatarId), fresh.length);
  const kids = [...existing, ...fresh.map((spec, i) => planNewKid(spec, avatars[i], options.now, args.shopPay))];

  const contacts = planContacts({ guardian, familyWallet, kids }, snapshot, args);
  for (const kid of kids) {
    const unsynced = kid.id ? snapshot.contacts.filter((c) => c.kid_id === kid.id && c.status === "active" && !c.onchain_synced).length : 0;
    kid.contactsToSync = unsynced + contacts.rows.filter((r) => r.kidName === kid.name).length;
  }

  const keeperId = snapshot.family.keeper_role_id;
  return {
    family: { id: snapshot.family.id, name: snapshot.family.name, timezone: snapshot.family.timezone },
    guardian,
    root,
    familyWallet,
    allowanceNextRunAt: nextMondayAt(options.now, DEFAULTS.timezone),
    kids,
    contacts,
    treasury: planTreasury(snapshot, args.treasury),
    shopPay: args.shopPay,
    keeper: keeperId === undefined ? "unknown" : keeperId === null ? "off" : "on",
  };
}

/** The applier's half of an AddressRef: known addresses pass through; a kid's new spend wallet comes from `spendByKid` (by name, case-insensitive). */
export function resolveAddress(ref: AddressRef, spendByKid: ReadonlyMap<string, string>): string {
  if ("address" in ref) return ref.address;
  const address = spendByKid.get(norm(ref.spendOf));
  if (!address) throw new Error(`resolveAddress: ${ref.spendOf}'s spend wallet has not been created yet.`);
  return address;
}

// --- Print ----------------------------------------------------------------------

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function describeKid(kid: KidPlan): string {
  const born = kid.birthMonth && kid.birthYear ? `born ${MONTHS[kid.birthMonth - 1]} ${kid.birthYear}, ` : "";
  const facts = `${born}age ${kid.age ?? "unknown"}, ${kid.avatarId}`;
  const steps = [
    ...(kid.createWallets ? [`${WALLET_KINDS.length} Swig wallets on Solana`] : []),
    ...(kid.createLimits ? [`limits (${unitsToDisplay(DEFAULTS.kidDailyUnits)} a day, ${unitsToDisplay(DEFAULTS.kidWeeklyUnits)} a week, approval above ${unitsToDisplay(DEFAULTS.approvalThresholdUnits)})`] : []),
    ...(kid.allowanceUnits !== null ? [`allowance ${unitsToDisplay(kid.allowanceUnits)} a week`] : []),
  ];
  if (kid.create) return `${kid.name}: new (${facts}). Kid row, ${steps.join(", ")}`;
  if (steps.length === 0) return `${kid.name}: exists (${facts}), keeping`;
  return `${kid.name}: exists (${facts}); adding what is missing: ${steps.join(", ")}`;
}

function describeContact(row: ContactPlan): string {
  const why = { family: "family wallet", sibling: "sibling", contact: "", zara: "blocked-send demo" }[row.why];
  const notes = [why, "spendOf" in row.to ? "wallet created in this run" : "", row.reactivateId ? "back on the list" : ""].filter(Boolean);
  return `${row.label} ${unitsToDisplay(row.weeklyUnits)}/wk${notes.length ? ` (${notes.join(", ")})` : ""}`;
}

/** The plan as the operator reads it before saying yes. `ata` is the treasury token account, when known. */
export function formatSeedPlan(plan: DemoSeedPlan, view: { dryRun: boolean; ata: string | null }): string {
  const inserts = plan.contacts.rows.filter((r) => !r.reactivateId).length;
  const reactivates = plan.contacts.rows.length - inserts;
  const shopOn = plan.kids.filter((k) => k.shopPayOn).map((k) => k.name);
  const treasury = plan.treasury;
  const lines = [
    `Edventures Wallet demo seed${view.dryRun ? " (dry run: nothing changes)" : ""}`,
    `Family:   ${plan.family.name} (${plan.family.id}), timezone ${plan.family.timezone}`,
    `Guardian: ${plan.guardian.label}${plan.guardian.email ? ` (${plan.guardian.email})` : ""}; device ${plan.root.pubkey} is the root of every kid wallet`,
    `Treasury: ${plan.familyWallet.walletAddress}${view.ata ? ` (token account ${view.ata})` : ""}`,
    "",
    `1. Kids: create ${count(plan.kids.filter((k) => k.create).length, "kid")}, keep ${plan.kids.filter((k) => !k.create).length}`,
    ...plan.kids.map((k) => `     ${describeKid(k)}`),
    `2. Contacts: insert ${count(inserts, "row")}${reactivates ? `, bring back ${reactivates}` : ""} (not on-chain until "Update on-chain" on /family/rules)`,
    ...plan.kids.flatMap((k) => {
      const rows = plan.contacts.rows.filter((r) => r.kidName === k.name);
      return rows.length ? [`     ${k.name}: ${rows.map(describeContact).join(", ")}`] : [];
    }),
    ...plan.contacts.skipped.map((s) => `     skipped ${s.kidName}: ${s.label} (${s.reason})`),
    treasury === null
      ? "3. Treasury: left alone (--treasury 0)"
      : treasury.mint > 0n
        ? `3. Treasury: holds ${unitsToDisplay(treasury.held)}; mint ${unitsToDisplay(treasury.mint)} of test USDC so it holds ${unitsToDisplay(treasury.target)}`
        : `3. Treasury: holds ${unitsToDisplay(treasury.held)}, already at least ${unitsToDisplay(treasury.target)}; nothing to mint`,
    shopOn.length ? `4. Pay a shop: switch on for ${shopOn.join(", ")}` : plan.shopPay ? "4. Pay a shop: already on for every kid" : "4. Pay a shop: none (pass --shop-pay to switch it on for every kid)",
    "",
    "Leaves alone: every kid, wallet, contact, allowance, limit, device, invite and event that already exists.",
  ];
  return lines.join("\n");
}

/** What the seed cannot do, per kid, for the operator to finish in the app. */
export function formatNextSteps(plan: DemoSeedPlan): string {
  const width = Math.max(...plan.kids.map((k) => k.name.length), 0);
  const invite = (k: KidPlan) => (k.invite ? `invite ${k.invite.accepted ? "accepted" : "sent, not accepted"} (${k.invite.email})` : "no invite");
  const device = (k: KidPlan) => ({ none: "no device", pending: "device waiting for approval", active: "device active" })[k.device];
  const sync = (k: KidPlan) => (k.contactsToSync > 0 ? `${count(k.contactsToSync, "contact")} to push on-chain` : "contacts on-chain");
  const lines = [
    "Then, in the app:",
    ...plan.kids.map((k) => `  ${k.name.padEnd(width)}  ${invite(k)}; ${device(k)}; ${sync(k)}`),
    `  Keeper role: ${plan.keeper}${plan.keeper === "unknown" ? " (families.keeper_role_id does not exist yet)" : ""}`,
    "  - Invite each kid by email from /family; they accept on /join; then approve the device on-chain from /family.",
    '  - Push new contacts on-chain with "Update on-chain" on /family/rules (after the device is approved).',
    "  - Turn on automatic allowance on /family/allowance so the keeper role can pay allowances from the family wallet.",
  ];
  return lines.join("\n");
}
