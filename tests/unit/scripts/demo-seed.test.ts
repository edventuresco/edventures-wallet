import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { ANIMAL_AVATAR_IDS, formatNextSteps, formatSeedPlan, nextAvatars, parseContacts, parseDemoSeedArgs, parseKids, parseTreasury, planDemoSeed, resolveAddress, ZARA_WEEKLY_UNITS, type DemoSeedArgs, type SeedSnapshot } from "@/lib/demo/seed";
import { DEFAULTS } from "@/lib/family/defaults";

// 13:30 in Kuching on Monday 7 Sept 2026.
const NOW = new Date("2026-09-07T05:30:00Z");

const PARENT = "user-parent";
const OTHER_GUARDIAN = "user-other";
const KID_A_DEVICE = "user-kid-a";
const ROOT_PUBKEY = "RootDevicePubkey1111";

const GRANDMA = Keypair.generate().publicKey.toBase58();
const FRIEND = Keypair.generate().publicKey.toBase58();
const ZARA = Keypair.generate().publicKey.toBase58();

const noArgs: DemoSeedArgs = { family: "fam-1", kids: [], contacts: [], zara: null, treasury: "100", shopPay: false, dryRun: false, yes: false, help: false };
const args = (over: Partial<DemoSeedArgs> = {}): DemoSeedArgs => ({ ...noArgs, ...over });

/** Otter family: one guardian with a device, a treasury, and Ari (complete, invited, device active) plus Bo (rows only, nothing on-chain). */
function snapshot(overrides: Partial<SeedSnapshot> = {}): SeedSnapshot {
  return {
    family: { id: "fam-1", name: "Otter family", timezone: "Asia/Kuching", keeper_role_id: null },
    guardians: [{ user_id: PARENT, label: "Parent", email: "parent@example.com" }],
    devices: [
      { id: "dev-parent", kid_id: null, user_id: PARENT, status: "active", pubkey: ROOT_PUBKEY },
      { id: "dev-a", kid_id: "kid-a", user_id: KID_A_DEVICE, status: "active", pubkey: "KidADevice1111" },
    ],
    kids: [
      { id: "kid-a", name: "Ari", avatar_id: "otter", birth_month: 3, birth_year: 2017, shop_pay_enabled: false },
      { id: "kid-b", name: "Bo", avatar_id: "fox", birth_month: 1, birth_year: 2019, shop_pay_enabled: true },
    ],
    wallets: [
      { id: "w-family", kid_id: null, kind: "family", wallet_address: "FamilyTreasury1111" },
      { id: "w-a-spend", kid_id: "kid-a", kind: "spend", wallet_address: "AriSpend1111" },
      { id: "w-a-save", kid_id: "kid-a", kind: "save", wallet_address: "AriSave1111" },
      { id: "w-a-share", kid_id: "kid-a", kind: "share", wallet_address: "AriShare1111" },
      { id: "w-b-spend", kid_id: "kid-b", kind: "spend", wallet_address: "BoSpend1111" },
      { id: "w-b-save", kid_id: "kid-b", kind: "save", wallet_address: "BoSave1111" },
      { id: "w-b-share", kid_id: "kid-b", kind: "share", wallet_address: "BoShare1111" },
    ],
    contacts: [
      { id: "c-a-mum", kid_id: "kid-a", label: "Mum", address: "FamilyTreasury1111", status: "active", onchain_synced: true },
      { id: "c-a-bo", kid_id: "kid-a", label: "Bo", address: "BoSpend1111", status: "active", onchain_synced: true },
      { id: "c-b-mum", kid_id: "kid-b", label: "Mum", address: "FamilyTreasury1111", status: "active", onchain_synced: false },
      { id: "c-b-ari", kid_id: "kid-b", label: "Ari", address: "AriSpend1111", status: "active", onchain_synced: false },
    ],
    limits: [
      { id: "l-guardian", kid_id: null },
      { id: "l-a", kid_id: "kid-a" },
      { id: "l-b", kid_id: "kid-b" },
    ],
    allowances: [
      { id: "al-a", kid_id: "kid-a" },
      { id: "al-b", kid_id: "kid-b" },
    ],
    invites: [
      { kid_id: "kid-a", email: "ari-old@example.com", created_at: "2026-09-01T00:00:00Z", accepted_at: null },
      { kid_id: "kid-a", email: "ari@example.com", created_at: "2026-09-02T00:00:00Z", accepted_at: "2026-09-03T00:00:00Z" },
    ],
    treasuryUnits: 40_000_000n,
    ...overrides,
  };
}

/** The row as it comes back before a migration adds `key`. */
function without<T extends object, K extends keyof T>(row: T, key: K): Omit<T, K> {
  const copy = { ...row };
  delete copy[key];
  return copy;
}

const plan = (snap: SeedSnapshot, over: Partial<DemoSeedArgs> = {}, guardianUserId: string | null = null) => planDemoSeed(snap, args(over), { now: NOW, guardianUserId });
const kid = (p: ReturnType<typeof plan>, name: string) => {
  const found = p.kids.find((k) => k.name === name);
  if (!found) throw new Error(`no kid ${name} in the plan`);
  return found;
};
const contactsOf = (p: ReturnType<typeof plan>, name: string) => p.contacts.rows.filter((r) => r.kidName === name);

describe("parseKids and parseContacts", () => {
  it("reads Name:birthYear pairs and trims", () => {
    expect(parseKids(" Ten:2016 , Eight:2018,")).toEqual([
      { name: "Ten", birthYear: 2016 },
      { name: "Eight", birthYear: 2018 },
    ]);
    expect(parseKids("")).toEqual([]);
  });
  it("rejects a malformed kid, a year outside kids.birth_year, and a repeated name", () => {
    expect(() => parseKids("Ten")).toThrow(/Name:birthYear/);
    expect(() => parseKids(":2016")).toThrow(/Name:birthYear/);
    expect(() => parseKids("Ten:16")).toThrow(/Name:birthYear/);
    expect(() => parseKids("Ten:1999")).toThrow(/between 2000 and 2030/);
    expect(() => parseKids("Ten:2016,ten:2017")).toThrow(/names Ten twice/);
  });
  it("reads Label:address pairs with the app's contact checks", () => {
    expect(parseContacts(`Grandma:${GRANDMA}, Friend :${FRIEND}`)).toEqual([
      { label: "Grandma", address: GRANDMA },
      { label: "Friend", address: FRIEND },
    ]);
  });
  it("rejects a bad address, an empty label and a repeated address", () => {
    expect(() => parseContacts("Grandma:not-an-address")).toThrow(/Solana address/);
    expect(() => parseContacts(`:${GRANDMA}`)).toThrow(/Give this person a name/);
    expect(() => parseContacts(GRANDMA)).toThrow(/Label:address/);
    expect(() => parseContacts(`Grandma:${GRANDMA},Nana:${GRANDMA}`)).toThrow(/twice/);
  });
});

describe("parseDemoSeedArgs", () => {
  it("reads every flag, in both spellings, with the treasury defaulting to $100", () => {
    expect(parseDemoSeedArgs(["--family", "fam-1", "--kids", "Ten:2016", "--contacts", `Grandma:${GRANDMA}`, "--zara", ZARA, "--treasury", "250", "--shop-pay", "--dry-run", "--yes"])).toEqual({
      family: "fam-1",
      kids: [{ name: "Ten", birthYear: 2016 }],
      contacts: [{ label: "Grandma", address: GRANDMA }],
      zara: ZARA,
      treasury: "250",
      shopPay: true,
      dryRun: true,
      yes: true,
      help: false,
    });
    expect(parseDemoSeedArgs(["--family=parent@example.com", `--zara=${ZARA}`])).toMatchObject({ family: "parent@example.com", zara: ZARA, treasury: "100", kids: [], contacts: [] });
  });
  it("requires --family unless asking for help", () => {
    expect(() => parseDemoSeedArgs([])).toThrow(/--family is required/);
    expect(parseDemoSeedArgs(["--help"]).help).toBe(true);
  });
  it("rejects a flag without its value, an unknown flag, a bad --zara, and Zara doubling as a contact", () => {
    expect(() => parseDemoSeedArgs(["--family"])).toThrow(/--family needs a value/);
    expect(() => parseDemoSeedArgs(["--family", "fam-1", "--kids", "--yes"])).toThrow(/--kids needs a value/);
    expect(() => parseDemoSeedArgs(["--family", "fam-1", "--reset"])).toThrow(/Unknown option --reset/);
    expect(() => parseDemoSeedArgs(["--family", "fam-1", "--zara", "nope"])).toThrow(/--zara.*Solana address/);
    expect(() => parseDemoSeedArgs(["--family", "fam-1", "--contacts", `Zed:${ZARA}`, "--zara", ZARA])).toThrow(/already in --contacts/);
  });
});

describe("nextAvatars", () => {
  it("hands out the animal set in picker order, skipping avatars the family uses, and cycles when they run out", () => {
    expect(ANIMAL_AVATAR_IDS.slice(0, 3)).toEqual(["otter", "fox", "panda"]);
    expect(nextAvatars(["otter", "koala"], 3)).toEqual(["fox", "panda", "owl"]);
    expect(nextAvatars([], 22)).toEqual([...ANIMAL_AVATAR_IDS, "otter", "fox"]);
    expect(nextAvatars(ANIMAL_AVATAR_IDS, 2)).toEqual(["otter", "fox"]);
    expect(nextAvatars(["maya"], 0)).toEqual([]);
  });
});

describe("planDemoSeed: refusals", () => {
  it("needs a guardian with a registered device, the named guardian when --family was an email", () => {
    expect(() => plan(snapshot({ devices: [snapshot().devices[1]] }))).toThrow(/No guardian of "Otter family" has a registered device/);
    const two = snapshot({ guardians: [...snapshot().guardians, { user_id: OTHER_GUARDIAN, label: "Guardian", email: "other@example.com" }] });
    expect(plan(two).guardian.userId).toBe(PARENT);
    expect(() => plan(two, {}, OTHER_GUARDIAN)).toThrow(/other@example.com has no registered device/);
    expect(plan(two, {}, PARENT).root).toEqual({ deviceId: "dev-parent", pubkey: ROOT_PUBKEY });
  });
  it("ignores pending and revoked guardian devices and kid devices when picking the root", () => {
    const snap = snapshot({
      devices: [
        { id: "dev-parent-old", kid_id: null, user_id: PARENT, status: "revoked", pubkey: "Old1111" },
        { id: "dev-parent-code", kid_id: null, user_id: PARENT, status: "pending", pubkey: "pending:1111" },
        { id: "dev-a", kid_id: "kid-a", user_id: PARENT, status: "active", pubkey: "KidADevice1111" },
        { id: "dev-parent", kid_id: null, user_id: PARENT, status: "active", pubkey: ROOT_PUBKEY },
      ],
    });
    expect(plan(snap).root.deviceId).toBe("dev-parent");
  });
  it("needs the family wallet", () => {
    expect(() => plan(snapshot({ wallets: snapshot().wallets.slice(1) }))).toThrow(/no family wallet/);
  });
  it("refuses a kid with some but not all wallets, and two kids with one name", () => {
    expect(() => plan(snapshot({ wallets: snapshot().wallets.filter((w) => w.id !== "w-b-share") }))).toThrow(/Bo has 2 of 3 wallets \(spend, save\)/);
    expect(() => plan(snapshot({ kids: [...snapshot().kids, { ...snapshot().kids[0], id: "kid-a2", name: "ari " }] }))).toThrow(/two kids named ari/);
  });
  it("refuses --shop-pay before the shop-pay migration, and bad treasury amounts", () => {
    const noColumn = snapshot({ kids: snapshot().kids.map((k) => without(k, "shop_pay_enabled")) });
    expect(() => plan(noColumn, { shopPay: true })).toThrow(/kid_shop_pay\.sql/);
    expect(plan(noColumn).kids.every((k) => !k.shopPayOn)).toBe(true);
    expect(() => plan(snapshot(), { treasury: "lots" })).toThrow(/--treasury needs a dollar amount/);
    expect(() => plan(snapshot({ treasuryUnits: null }), { treasury: "100" })).toThrow(/treasury balance was not read/);
  });
});

describe("planDemoSeed: kids", () => {
  it("creates the kids that do not exist by name, mirroring addKid, and keeps the rest", () => {
    const p = plan(snapshot(), { kids: [{ name: "Ten", birthYear: 2016 }, { name: "ari", birthYear: 2010 }] });
    expect(p.kids.map((k) => [k.name, k.create])).toEqual([
      ["Ari", false],
      ["Bo", false],
      ["Ten", true],
    ]);
    expect(kid(p, "Ten")).toMatchObject({
      id: null,
      avatarId: "panda",
      birthMonth: 1,
      birthYear: 2016,
      age: 10,
      createWallets: true,
      createLimits: true,
      allowanceUnits: 10_000_000n,
      shopPayOn: false,
      invite: null,
      device: "none",
    });
    expect(kid(p, "Ari")).toMatchObject({ id: "kid-a", avatarId: "otter", age: 9, createWallets: false, createLimits: false, allowanceUnits: null, birthYear: 2017 });
    expect(p.allowanceNextRunAt.toISOString()).toBe("2026-09-14T01:00:00.000Z");
  });
  it("cycles avatars past the ones the family already uses", () => {
    const p = plan(snapshot(), { kids: [{ name: "Ten", birthYear: 2016 }, { name: "Eight", birthYear: 2018 }] });
    expect([kid(p, "Ten").avatarId, kid(p, "Eight").avatarId]).toEqual(["panda", "koala"]);
  });
  it("adds only what an existing kid is missing: wallets, limits, allowance", () => {
    const bare = snapshot({ wallets: snapshot().wallets.filter((w) => w.kid_id !== "kid-b"), limits: [{ id: "l-a", kid_id: "kid-a" }], allowances: [{ id: "al-a", kid_id: "kid-a" }] });
    const p = plan(bare);
    expect(kid(p, "Bo")).toMatchObject({ create: false, createWallets: true, createLimits: true, allowanceUnits: 7_000_000n, age: 7 });
    expect(kid(p, "Ari")).toMatchObject({ create: false, createWallets: false, createLimits: false, allowanceUnits: null });
  });
  it("gives $5 a week when the age is unknown", () => {
    const p = plan(snapshot({ kids: [{ id: "kid-x", name: "X", avatar_id: "owl", birth_month: null, birth_year: null, shop_pay_enabled: false }], wallets: [snapshot().wallets[0]], limits: [], allowances: [], contacts: [] }));
    expect(kid(p, "X")).toMatchObject({ age: null, allowanceUnits: 5_000_000n, createWallets: true });
  });
  it("reports the newest invite and the device state for each existing kid", () => {
    const snap = snapshot({
      devices: [...snapshot().devices, { id: "dev-b", kid_id: "kid-b", user_id: "user-kid-b", status: "pending", pubkey: "KidBDevice1111" }],
      invites: [...snapshot().invites, { kid_id: "kid-b", email: "bo@example.com", created_at: "2026-09-05T00:00:00Z", accepted_at: null }],
    });
    const p = plan(snap);
    expect(kid(p, "Ari")).toMatchObject({ invite: { email: "ari@example.com", accepted: true }, device: "active" });
    expect(kid(p, "Bo")).toMatchObject({ invite: { email: "bo@example.com", accepted: false }, device: "pending" });
  });
});

describe("planDemoSeed: contacts", () => {
  it("gives a new kid the family wallet, every sibling both ways, --contacts and Zara", () => {
    const p = plan(snapshot(), { kids: [{ name: "Ten", birthYear: 2016 }], contacts: [{ label: "Grandma", address: GRANDMA }], zara: ZARA });
    expect(contactsOf(p, "Ten")).toEqual([
      { kidName: "Ten", label: "Mum", avatarId: "parent", to: { address: "FamilyTreasury1111" }, weeklyUnits: DEFAULTS.perContactWeeklyUnits, why: "family", reactivateId: null },
      { kidName: "Ten", label: "Ari", avatarId: "otter", to: { address: "AriSpend1111" }, weeklyUnits: DEFAULTS.perContactWeeklyUnits, why: "sibling", reactivateId: null },
      { kidName: "Ten", label: "Bo", avatarId: "fox", to: { address: "BoSpend1111" }, weeklyUnits: DEFAULTS.perContactWeeklyUnits, why: "sibling", reactivateId: null },
      { kidName: "Ten", label: "Grandma", avatarId: "person", to: { address: GRANDMA }, weeklyUnits: DEFAULTS.perContactWeeklyUnits, why: "contact", reactivateId: null },
      { kidName: "Ten", label: "Zara", avatarId: "person", to: { address: ZARA }, weeklyUnits: ZARA_WEEKLY_UNITS, why: "zara", reactivateId: null },
    ]);
    expect(ZARA_WEEKLY_UNITS).toBe(2_000_000n);
    // The siblings get Ten back, pointing at the spend wallet this run creates; their existing rows are skipped.
    expect(contactsOf(p, "Ari")).toEqual([
      { kidName: "Ari", label: "Ten", avatarId: "panda", to: { spendOf: "Ten" }, weeklyUnits: DEFAULTS.perContactWeeklyUnits, why: "sibling", reactivateId: null },
      { kidName: "Ari", label: "Grandma", avatarId: "person", to: { address: GRANDMA }, weeklyUnits: DEFAULTS.perContactWeeklyUnits, why: "contact", reactivateId: null },
      { kidName: "Ari", label: "Zara", avatarId: "person", to: { address: ZARA }, weeklyUnits: ZARA_WEEKLY_UNITS, why: "zara", reactivateId: null },
    ]);
    expect(p.contacts.skipped).toEqual([
      { kidName: "Ari", label: "Mum", reason: "already on the list as Mum" },
      { kidName: "Ari", label: "Bo", reason: "already on the list as Bo" },
      { kidName: "Bo", label: "Mum", reason: "already on the list as Mum" },
      { kidName: "Bo", label: "Ari", reason: "already on the list as Ari" },
    ]);
  });
  it("names the family wallet Guardian when the root guardian is one", () => {
    const p = plan(snapshot({ guardians: [{ user_id: PARENT, label: "Guardian", email: null }] }), { kids: [{ name: "Ten", birthYear: 2016 }] });
    expect(contactsOf(p, "Ten")[0]).toMatchObject({ label: "Guardian", avatarId: "parent" });
  });
  it("links two new kids to each other through their new spend wallets", () => {
    const p = plan(snapshot({ kids: [], wallets: [snapshot().wallets[0]], contacts: [], limits: [], allowances: [], invites: [], devices: [snapshot().devices[0]] }), { kids: [{ name: "Ten", birthYear: 2016 }, { name: "Eight", birthYear: 2018 }] });
    expect(contactsOf(p, "Ten").map((r) => [r.label, r.to])).toEqual([
      ["Mum", { address: "FamilyTreasury1111" }],
      ["Eight", { spendOf: "Eight" }],
    ]);
    expect(contactsOf(p, "Eight").map((r) => [r.label, r.to])).toEqual([
      ["Mum", { address: "FamilyTreasury1111" }],
      ["Ten", { spendOf: "Ten" }],
    ]);
  });
  it("brings a removed contact back instead of duplicating, like addContact, and skips a requested one", () => {
    const snap = snapshot({
      contacts: [
        ...snapshot().contacts,
        { id: "c-a-grandma", kid_id: "kid-a", label: "Nana", address: GRANDMA, status: "removed", onchain_synced: false },
        { id: "c-b-grandma", kid_id: "kid-b", label: "Grandma", address: GRANDMA, status: "requested", onchain_synced: false },
      ],
    });
    const p = plan(snap, { contacts: [{ label: "Grandma", address: GRANDMA }] });
    expect(contactsOf(p, "Ari")).toEqual([{ kidName: "Ari", label: "Grandma", avatarId: "person", to: { address: GRANDMA }, weeklyUnits: DEFAULTS.perContactWeeklyUnits, why: "contact", reactivateId: "c-a-grandma" }]);
    expect(contactsOf(p, "Bo")).toEqual([]);
    expect(p.contacts.skipped).toContainEqual({ kidName: "Bo", label: "Grandma", reason: "already on the list as Grandma (requested)" });
  });
  it("skips a --contacts address that is already a sibling or the family wallet", () => {
    const p = plan(snapshot(), { kids: [{ name: "Ten", birthYear: 2016 }], contacts: [{ label: "Treasury", address: "FamilyTreasury1111" }] });
    expect(p.contacts.skipped).toContainEqual({ kidName: "Ten", label: "Treasury", reason: "same address as Mum" });
    expect(contactsOf(p, "Ten").map((r) => r.label)).toEqual(["Mum", "Ari", "Bo"]);
  });
  it("counts what each kid still has to push on-chain", () => {
    const p = plan(snapshot(), { zara: ZARA });
    expect(kid(p, "Ari").contactsToSync).toBe(1);
    expect(kid(p, "Bo").contactsToSync).toBe(3);
    expect(kid(plan(snapshot()), "Ari").contactsToSync).toBe(0);
  });
});

describe("planDemoSeed: treasury, shop pay, keeper", () => {
  it("mints only the difference up to the target", () => {
    expect(plan(snapshot()).treasury).toEqual({ target: 100_000_000n, held: 40_000_000n, mint: 60_000_000n });
    expect(plan(snapshot({ treasuryUnits: 0n })).treasury).toEqual({ target: 100_000_000n, held: 0n, mint: 100_000_000n });
    expect(plan(snapshot({ treasuryUnits: 120_000_000n })).treasury).toEqual({ target: 100_000_000n, held: 120_000_000n, mint: 0n });
    expect(plan(snapshot(), { treasury: "$25.50" }).treasury).toEqual({ target: 25_500_000n, held: 40_000_000n, mint: 0n });
    expect(plan(snapshot({ treasuryUnits: null }), { treasury: "0" }).treasury).toBeNull();
    expect(plan(snapshot({ treasuryUnits: null }), { treasury: "0.00" }).treasury).toBeNull();
    expect(parseTreasury("0.00")).toBe(0n);
    expect(() => parseTreasury("1.2345678")).toThrow(/--treasury needs a dollar amount/);
  });
  it("switches Pay a shop on for kids that do not have it, new kids included", () => {
    const p = plan(snapshot(), { kids: [{ name: "Ten", birthYear: 2016 }], shopPay: true });
    expect(p.kids.map((k) => [k.name, k.shopPayOn])).toEqual([
      ["Ari", true],
      ["Bo", false],
      ["Ten", true],
    ]);
  });
  it("reads the keeper from families.keeper_role_id", () => {
    expect(plan(snapshot()).keeper).toBe("off");
    expect(plan(snapshot({ family: { ...snapshot().family, keeper_role_id: 2 } })).keeper).toBe("on");
    expect(plan(snapshot({ family: without(snapshot().family, "keeper_role_id") })).keeper).toBe("unknown");
  });
});

describe("resolveAddress", () => {
  it("passes a known address through and looks a new spend wallet up by kid name", () => {
    const spendByKid = new Map([["ten", "TenSpend1111"]]);
    expect(resolveAddress({ address: GRANDMA }, spendByKid)).toBe(GRANDMA);
    expect(resolveAddress({ spendOf: "Ten" }, spendByKid)).toBe("TenSpend1111");
    expect(() => resolveAddress({ spendOf: "Eight" }, spendByKid)).toThrow(/Eight's spend wallet has not been created yet/);
  });
});

describe("formatSeedPlan and formatNextSteps", () => {
  it("says what changes, per kid and per list, and whether this is a dry run", () => {
    const snap = snapshot({ contacts: [...snapshot().contacts, { id: "c-a-grandma", kid_id: "kid-a", label: "Nana", address: GRANDMA, status: "removed", onchain_synced: false }] });
    const p = plan(snap, { kids: [{ name: "Ten", birthYear: 2016 }], contacts: [{ label: "Grandma", address: GRANDMA }], zara: ZARA, shopPay: true });
    const text = formatSeedPlan(p, { dryRun: true, ata: "TreasuryAta1111" });
    expect(text).toContain("(dry run: nothing changes)");
    expect(text).toContain("Otter family (fam-1)");
    expect(text).toContain(`Parent (parent@example.com); device ${ROOT_PUBKEY} is the root`);
    expect(text).toContain("FamilyTreasury1111 (token account TreasuryAta1111)");
    expect(text).toContain("1. Kids: create 1 kid, keep 2");
    expect(text).toContain("Ten: new (born Jan 2016, age 10, panda). Kid row, 3 Swig wallets on Solana, limits ($50.00 a day, $100.00 a week, approval above $20.00), allowance $10.00 a week");
    expect(text).toContain("Ari: exists (born Mar 2017, age 9, otter), keeping");
    // Ten: 5 (Mum, Ari, Bo, Grandma, Zara). Ari: Ten and Zara, Grandma comes back. Bo: Ten, Grandma, Zara.
    expect(text).toContain("2. Contacts: insert 10 rows, bring back 1");
    expect(text).toContain("Ten: Mum $50.00/wk (family wallet), Ari $50.00/wk (sibling), Bo $50.00/wk (sibling), Grandma $50.00/wk, Zara $2.00/wk (blocked-send demo)");
    expect(text).toContain("Ari: Ten $50.00/wk (sibling, wallet created in this run), Grandma $50.00/wk (back on the list), Zara $2.00/wk (blocked-send demo)");
    expect(text).toContain("skipped Ari: Mum (already on the list as Mum)");
    expect(text).toContain("3. Treasury: holds $40.00; mint $60.00 of test USDC so it holds $100.00");
    expect(text).toContain("4. Pay a shop: switch on for Ari, Ten");
    expect(text).toContain("Leaves alone:");
  });
  it("marks a live run, a full treasury, a skipped treasury, and no shop-pay change", () => {
    const full = formatSeedPlan(plan(snapshot({ treasuryUnits: 120_000_000n })), { dryRun: false, ata: null });
    expect(full).not.toContain("dry run");
    expect(full).toContain("3. Treasury: holds $120.00, already at least $100.00; nothing to mint");
    expect(full).toContain("4. Pay a shop: none (pass --shop-pay");
    expect(full).toContain("Contacts: insert 0 rows");
    const off = formatSeedPlan(plan(snapshot({ treasuryUnits: null }), { treasury: "0" }), { dryRun: false, ata: null });
    expect(off).toContain("3. Treasury: left alone (--treasury 0)");
    const already = formatSeedPlan(plan(snapshot({ kids: snapshot().kids.map((k) => ({ ...k, shop_pay_enabled: true })) }), { shopPay: true }), { dryRun: false, ata: null });
    expect(already).toContain("4. Pay a shop: already on for every kid");
  });
  it("lists, per kid, the invite, the device and what is left to push on-chain, then where to do it", () => {
    const p = plan(snapshot(), { kids: [{ name: "Ten", birthYear: 2016 }], zara: ZARA });
    const text = formatNextSteps(p);
    // Ari: Ten and Zara. Bo: two rows never pushed, plus Ten and Zara. Ten: Mum, Ari, Bo, Zara.
    expect(text).toContain("Ari  invite accepted (ari@example.com); device active; 2 contacts to push on-chain");
    expect(text).toContain("Bo   no invite; no device; 4 contacts to push on-chain");
    expect(text).toContain("Ten  no invite; no device; 4 contacts to push on-chain");
    expect(text).toContain("Keeper role: off");
    expect(text).toContain("Invite each kid by email from /family");
    expect(text).toContain('"Update on-chain" on /family/rules');
    expect(text).toContain("/family/allowance");
    expect(formatNextSteps(plan(snapshot()))).toContain("Ari  invite accepted (ari@example.com); device active; contacts on-chain");
  });
});
