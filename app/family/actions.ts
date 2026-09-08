"use server";

import { PublicKey, Transaction } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import { sendSignInCode } from "@/lib/auth/send-code";
import { requireUser } from "@/lib/auth/session";
import { base64ToBytes, bytesToBase64 } from "@/lib/device/encoding";
import { ageFromBirth, DEFAULTS, defaultAllowanceUnits, nextMondayAt } from "@/lib/family/defaults";
import { ataFor, buildApproveDeviceTx, createKidWallets, readKidRoleIds } from "@/lib/family/onchain";
import { familyTotalUnits, kidsTotalUnits } from "@/lib/family/balances";
import { getFamilyContext } from "@/lib/family/session";
import { toView, unitsToDisplay, type MoneyView } from "@/lib/money/usdc";
import { getConnection } from "@/lib/solana/connection";
import { explorerUrl } from "@/lib/solana/explorer";
import { keypairFromEnv } from "@/lib/solana/keys";
import { issuePreparedToken, messageHashOf, verifyPreparedToken } from "@/lib/sponsor/prepared";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type FamilyState = {
  family: { id: string; name: string } | null;
  guardianLabel: string | null;
  guardianDevice: { id: string; pubkey: string } | null;
  familyWallet: { walletAddress: string; balance: MoneyView } | null;
  /** The family wallet plus every kid's jars; null until the family wallet exists. */
  familyBalance: { total: MoneyView; kids: MoneyView } | null;
  kids: Array<{
    id: string;
    name: string;
    avatarId: string;
    age: number | null;
    owlName: string | null;
    balances: Record<"spend" | "save" | "share", MoneyView>;
    allowance: MoneyView | null;
    devices: Array<{ id: string; status: string; joined: boolean }>;
    /** The newest invite sent for this kid, if any. */
    invite: { email: string; sentAt: string; accepted: boolean } | null;
  }>;
  pendingApprovals: Array<{ deviceId: string; kidId: string; kidName: string }>;
};

async function balanceOf(walletAddress: string): Promise<bigint> {
  return getAccount(getConnection(), ataFor(walletAddress))
    .then((a) => a.amount)
    .catch(() => 0n);
}

export async function getFamilyState(): Promise<FamilyState> {
  const ctx = await getFamilyContext();
  const supabase = await createClient();
  const empty: FamilyState = { family: null, guardianLabel: null, guardianDevice: null, familyWallet: null, familyBalance: null, kids: [], pendingApprovals: [] };
  if (ctx.kind === "signed_out") return empty;

  const { data: myDevice } = await supabase.from("devices").select("id,pubkey").eq("user_id", ctx.userId).is("kid_id", null).eq("status", "active").maybeSingle();
  if (ctx.kind !== "guardian") return { ...empty, guardianDevice: myDevice ? { id: myDevice.id, pubkey: myDevice.pubkey } : null };

  const { data: family } = await supabase.from("families").select("id,name").eq("id", ctx.familyId).single();
  const { data: familyWallet } = await supabase.from("wallets").select("wallet_address").eq("family_id", ctx.familyId).eq("kind", "family").maybeSingle();
  const { data: kids } = await supabase.from("kids").select("id,name,avatar_id,birth_month,birth_year,owl_name").eq("family_id", ctx.familyId).order("created_at");
  const { data: wallets } = await supabase.from("wallets").select("kid_id,kind,wallet_address").eq("family_id", ctx.familyId).not("kid_id", "is", null);
  const { data: allowances } = await supabase.from("allowances").select("kid_id,amount_units").eq("family_id", ctx.familyId);
  const { data: devices } = await supabase.from("devices").select("id,kid_id,status,user_id").eq("family_id", ctx.familyId).not("kid_id", "is", null);
  const { data: invites } = await supabase.from("kid_invites").select("kid_id,email,created_at,accepted_at").eq("family_id", ctx.familyId).order("created_at", { ascending: false });

  const kidStates = await Promise.all(
    (kids ?? []).map(async (k) => {
      const w = (kind: string) => wallets?.find((x) => x.kid_id === k.id && x.kind === kind)?.wallet_address;
      const [spend, save, share] = await Promise.all([w("spend"), w("save"), w("share")].map((a) => (a ? balanceOf(a) : Promise.resolve(0n))));
      const allowance = allowances?.find((a) => a.kid_id === k.id);
      return {
        jars: { spend, save, share },
        id: k.id,
        name: k.name,
        avatarId: k.avatar_id,
        age: ageFromBirth(k.birth_month, k.birth_year, new Date()),
        owlName: k.owl_name,
        balances: { spend: toView(spend), save: toView(save), share: toView(share) },
        allowance: allowance ? toView(BigInt(allowance.amount_units)) : null,
        devices: (devices ?? [])
          .filter((d) => d.kid_id === k.id)
          .map((d) => ({ id: d.id, status: d.status, joined: Boolean(d.user_id) })),
        invite: (() => {
          const inv = invites?.find((i) => i.kid_id === k.id);
          return inv ? { email: inv.email, sentAt: inv.created_at, accepted: Boolean(inv.accepted_at) } : null;
        })(),
      };
    }),
  );

  const familyWalletUnits = familyWallet ? await balanceOf(familyWallet.wallet_address) : null;
  const jars = kidStates.map((k) => k.jars);
  return {
    family: family ? { id: family.id, name: family.name } : null,
    guardianLabel: ctx.label,
    guardianDevice: myDevice ? { id: myDevice.id, pubkey: myDevice.pubkey } : null,
    familyWallet: familyWallet && familyWalletUnits !== null ? { walletAddress: familyWallet.wallet_address, balance: toView(familyWalletUnits) } : null,
    familyBalance: familyWalletUnits !== null ? { total: toView(familyTotalUnits(familyWalletUnits, jars)), kids: toView(kidsTotalUnits(jars)) } : null,
    kids: kidStates.map(({ jars: _, ...kid }) => {
      void _;
      return kid;
    }),
    pendingApprovals: (devices ?? [])
      .filter((d) => d.status === "pending" && d.user_id)
      .map((d) => ({ deviceId: d.id, kidId: d.kid_id!, kidName: kids?.find((k) => k.id === d.kid_id)?.name ?? "your kid" })),
  };
}

export async function createFamily(input: { name: string; label: "Parent" | "Guardian" }): Promise<Result> {
  const user = await requireUser();
  const ctx = await getFamilyContext();
  if (ctx.kind === "guardian") return { ok: true };
  // The guardian row does not exist until this runs, so RLS cannot scope these writes yet.
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "Family setup isn't available right now." };
  const name = input.name.trim() || "Our family";
  const { data: family, error } = await admin.from("families").insert({ name }).select("id").single();
  if (error || !family) return { ok: false, error: "Couldn't start the family. Try again." };
  const { error: gErr } = await admin.from("guardians").insert({ family_id: family.id, user_id: user.id, label: input.label });
  if (gErr) return { ok: false, error: "Couldn't add you to the family. Try again." };
  await admin.from("limits").insert({
    family_id: family.id,
    kid_id: null,
    daily_limit_units: Number(DEFAULTS.guardianDailyUnits),
    weekly_limit_units: Number(DEFAULTS.guardianWeeklyUnits),
    approval_threshold_units: Number(DEFAULTS.approvalThresholdUnits),
  });
  // The guardian's slice-0 wallet becomes the family treasury.
  await admin.from("wallets").update({ family_id: family.id, kind: "family" }).eq("user_id", user.id).is("kid_id", null);
  await admin.from("devices").update({ family_id: family.id }).eq("user_id", user.id).is("kid_id", null);
  return { ok: true };
}

export async function addKid(input: { name: string; avatarId: string; birthMonth: number; birthYear: number }): Promise<Result<{ kidId: string }>> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can add a kid." };
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give your kid a name." };
  const { data: myDevice } = await supabase.from("devices").select("id,pubkey").eq("user_id", ctx.userId).is("kid_id", null).eq("status", "active").maybeSingle();
  if (!myDevice) return { ok: false, error: "Set up this device on the wallet page first." };
  const { data: familyWallet } = await supabase.from("wallets").select("wallet_address").eq("family_id", ctx.familyId).eq("kind", "family").maybeSingle();
  if (!familyWallet) return { ok: false, error: "Create your own wallet first; it becomes the family wallet." };

  const { data: kid, error } = await supabase
    .from("kids")
    .insert({ family_id: ctx.familyId, name, avatar_id: input.avatarId, birth_month: input.birthMonth, birth_year: input.birthYear, spend_pct: DEFAULTS.split.spend, save_pct: DEFAULTS.split.save, share_pct: DEFAULTS.split.share })
    .select("id")
    .single();
  if (error || !kid) return { ok: false, error: "Couldn't add your kid. Try again." };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "Adding kids isn't available right now." };
  const wallets = await createKidWallets(new PublicKey(myDevice.pubkey));
  const { error: wErr } = await admin.from("wallets").insert(
    (["spend", "save", "share"] as const).map((kind) => ({
      family_id: ctx.familyId,
      kid_id: kid.id,
      kind,
      swig_address: wallets[kind].swigAddress,
      wallet_address: wallets[kind].walletAddress,
      root_device_id: myDevice.id,
    })),
  );
  if (wErr) return { ok: false, error: "The wallets were created on Solana but couldn't be saved. Refresh and try again." };

  const age = ageFromBirth(input.birthMonth, input.birthYear, new Date());
  await supabase.from("limits").insert({
    family_id: ctx.familyId,
    kid_id: kid.id,
    daily_limit_units: Number(DEFAULTS.kidDailyUnits),
    weekly_limit_units: Number(DEFAULTS.kidWeeklyUnits),
    approval_threshold_units: Number(DEFAULTS.approvalThresholdUnits),
  });
  await supabase.from("allowances").insert({ family_id: ctx.familyId, kid_id: kid.id, amount_units: Number(defaultAllowanceUnits(age)), next_run_at: nextMondayAt(new Date(), DEFAULTS.timezone).toISOString() });

  // Whitelist: the family wallet, and every sibling both ways.
  const { data: siblings } = await supabase.from("wallets").select("kid_id,wallet_address,kids(name,avatar_id)").eq("family_id", ctx.familyId).eq("kind", "spend").neq("kid_id", kid.id);
  const perContact = Number(DEFAULTS.perContactWeeklyUnits);
  const contacts = [
    { family_id: ctx.familyId, kid_id: kid.id, label: ctx.label === "Guardian" ? "Guardian" : "Mum", avatar_id: "parent", address: familyWallet.wallet_address, weekly_limit_units: perContact, status: "active" },
    ...(siblings ?? []).flatMap((s) => {
      const sib = s.kids as unknown as { name: string; avatar_id: string } | null;
      return [
        { family_id: ctx.familyId, kid_id: kid.id, label: sib?.name ?? "Sibling", avatar_id: sib?.avatar_id ?? "otter", address: s.wallet_address, weekly_limit_units: perContact, status: "active" },
        { family_id: ctx.familyId, kid_id: s.kid_id!, label: name, avatar_id: input.avatarId, address: wallets.spend.walletAddress, weekly_limit_units: perContact, status: "active" },
      ];
    }),
  ];
  await supabase.from("contacts").insert(contacts);
  await supabase.from("events").insert({ user_id: ctx.userId, family_id: ctx.familyId, kid_id: kid.id, kind: "wallet_created", signature: wallets.spend.signature, summary: `${name}'s wallet was created on Solana` });
  return { ok: true, kidId: kid.id };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Guardian: invite a kid by email. The kid gets a six-digit code (through
 * Resend, lib/auth/send-code.ts): a new address becomes an invited account,
 * one that already has an account just gets a sign-in code. Either way the
 * kid signs in on /login, lands on /join, and the invite is matched by email.
 */
export async function inviteKid(input: { kidId: string; email: string }): Promise<Result<{ email: string }>> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can invite a kid." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "Invites aren't available right now." };
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "That doesn't look like an email." };
  const supabase = await createClient();
  const { data: kid } = await supabase.from("kids").select("id,name").eq("id", input.kidId).eq("family_id", ctx.familyId).maybeSingle();
  if (!kid) return { ok: false, error: "That kid isn't in your family." };
  const { data: myGuardianEmail } = await supabase.auth.getUser();
  if (myGuardianEmail.user?.email?.toLowerCase() === email) return { ok: false, error: "That's your own email. Use the kid's, or yours with +name before the @." };

  const { error: invErr } = await admin.from("kid_invites").insert({ family_id: ctx.familyId, kid_id: kid.id, email, invited_by: ctx.userId });
  if (invErr) return { ok: false, error: "Couldn't save the invite. Try again." };

  const sent = await sendSignInCode({ kind: "kid_invite", email, kidName: kid.name });
  if (!sent.ok) return { ok: false, error: "The invite was saved but the email didn't go out. Try again in a minute." };
  return { ok: true, email };
}

/** Kid device: has the guardian approved yet? */
export async function getJoinStatus(pubkey: string): Promise<{ status: "none" | "pending" | "active"; kidName?: string }> {
  const user = await requireUser();
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "none" };
  const { data } = await admin.from("devices").select("status,kids(name)").eq("user_id", user.id).eq("pubkey", pubkey).maybeSingle();
  if (!data) return { status: "none" };
  const kid = data.kids as unknown as { name: string } | null;
  return { status: data.status === "active" ? "active" : "pending", kidName: kid?.name };
}

/** Guardian: build the transaction that puts the kid's device on all three wallets. */
export async function prepareApproveDevice(deviceId: string): Promise<Result<{ token: string; txBase64: string; summary: string }>> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can approve a device." };
  const supabase = await createClient();
  const { data: device } = await supabase.from("devices").select("id,kid_id,pubkey,status,user_id").eq("id", deviceId).single();
  if (!device?.kid_id || device.status !== "pending" || !device.user_id || device.pubkey.startsWith("pending:")) return { ok: false, error: "That device hasn't joined yet." };
  const { data: myDevice } = await supabase.from("devices").select("pubkey").eq("user_id", ctx.userId).is("kid_id", null).eq("status", "active").maybeSingle();
  if (!myDevice) return { ok: false, error: "Set up this device on the wallet page first." };
  const { data: wallets } = await supabase.from("wallets").select("kind,swig_address,wallet_address").eq("kid_id", device.kid_id);
  const byKind = Object.fromEntries((wallets ?? []).map((w) => [w.kind, { swigAddress: w.swig_address, walletAddress: w.wallet_address }])) as Record<"spend" | "save" | "share", { swigAddress: string; walletAddress: string }>;
  if (!byKind.spend || !byKind.save || !byKind.share) return { ok: false, error: "This kid's wallets aren't ready." };
  const { data: contacts } = await supabase.from("contacts").select("address,weekly_limit_units").eq("kid_id", device.kid_id).eq("status", "active");
  const { data: limits } = await supabase.from("limits").select("daily_limit_units").eq("kid_id", device.kid_id).maybeSingle();
  const dailyUnits = BigInt(limits?.daily_limit_units ?? Number(DEFAULTS.kidDailyUnits));

  const { tx } = await buildApproveDeviceTx({
    guardianDevicePubkey: myDevice.pubkey,
    kidDevicePubkey: device.pubkey,
    wallets: byKind,
    contacts: (contacts ?? []).map((c) => ({ address: c.address, weeklyUnits: BigInt(c.weekly_limit_units) })),
    dailyLimitUnits: dailyUnits,
  });
  const token = await issuePreparedToken({ userId: ctx.userId, messageHash: messageHashOf(tx), purpose: "approve_device" });
  const { data: kid } = await supabase.from("kids").select("name").eq("id", device.kid_id).single();
  return {
    ok: true,
    token,
    txBase64: bytesToBase64(new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }))),
    summary: `Approve this device for ${kid?.name ?? "your kid"}: ${(contacts ?? []).length} people on the list, ${unitsToDisplay(dailyUnits)} a day`,
  };
}

export async function submitApproveDevice(input: { deviceId: string; token: string; signedTxBase64: string }): Promise<Result<{ explorerUrl: string }>> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can approve a device." };
  const claims = await verifyPreparedToken(input.token);
  if (!claims || claims.userId !== ctx.userId || claims.purpose !== "approve_device") return { ok: false, error: "That took too long. Try again." };
  const tx = Transaction.from(base64ToBytes(input.signedTxBase64));
  if (messageHashOf(tx) !== claims.messageHash) return { ok: false, error: "This isn't the transaction we prepared." };

  const supabase = await createClient();
  const { data: device } = await supabase.from("devices").select("id,kid_id,pubkey").eq("id", input.deviceId).single();
  if (!device?.kid_id) return { ok: false, error: "Device not found." };
  const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const connection = getConnection();
  tx.partialSign(feePayer);
  const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction({ signature, ...(await connection.getLatestBlockhash("confirmed")) }, "confirmed");

  const { data: wallets } = await supabase.from("wallets").select("kind,swig_address").eq("kid_id", device.kid_id);
  const byKind = Object.fromEntries((wallets ?? []).map((w) => [w.kind, { swigAddress: w.swig_address }])) as Record<"spend" | "save" | "share", { swigAddress: string }>;
  const roleIds = await readKidRoleIds(device.pubkey, byKind);
  await supabase.from("devices").update({ status: "active", role_id: roleIds.spend }).eq("id", device.id);
  // Any code that was never typed is moot now.
  await supabase.from("devices").delete().eq("kid_id", device.kid_id).eq("status", "pending").is("user_id", null);
  await supabase.from("contacts").update({ onchain_synced: true }).eq("kid_id", device.kid_id).eq("status", "active");
  await supabase.from("limits").update({ onchain_synced: true }).eq("kid_id", device.kid_id);
  await supabase.from("events").insert({ user_id: ctx.userId, family_id: ctx.familyId, kid_id: device.kid_id, kind: "device_paired", signature, summary: "A device was paired and its rules went on-chain" });
  return { ok: true, explorerUrl: explorerUrl(signature, "tx") };
}
