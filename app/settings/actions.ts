"use server";

// Settings: account, this device, the family, and (guardians only) opt-in
// shop payments. Reads go through the user's own session so RLS scopes
// them; the two writes RLS has no policy for (a guardian's own label, the
// family's Sqril customer id) use the admin client after the guardian check.

import { PublicKey } from "@solana/web3.js";
import { requireUser } from "@/lib/auth/session";
import { getFamilyContext } from "@/lib/family/session";
import { getConnection } from "@/lib/solana/connection";
import { loadWallet, roleIdOrNull } from "@/lib/swig/wallet";
import { isGuardianLabel, validateFamilyName, type GuardianLabel } from "@/lib/settings/family";
import { maskCustomerId, registerFamilyForPayments, type KycInput } from "@/lib/shop/kyc";
import { getSqrilClient } from "@/lib/sqril/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type SettingsState = {
  email: string | null;
  /** guardian: a parent or guardian of a family; kid: a paired kid device; none: signed in, no family yet. */
  kind: "guardian" | "kid" | "none";
  family: { id: string; name: string } | null;
  guardianLabel: GuardianLabel | null;
  /** The kid this device is paired to. */
  kidName: string | null;
  /** This account's own wallet on Solana (it becomes the family wallet). Guardians and users without a family. */
  hasWallet: boolean;
  /** Guardian only: the Sqril customer (masked) and which kids may pay shops. */
  payments: {
    customerIdMasked: string | null;
    kids: Array<{ id: string; name: string; avatarId: string; shopPayEnabled: boolean }>;
  } | null;
};

export type DeviceState = {
  registered: boolean;
  deviceId: string | null;
  /**
   * What the chain says: does this key hold a role on the user's wallet?
   * null when there is no wallet yet, or Solana could not be read just now.
   * A registered device whose key is not on the wallet cannot sign for it.
   */
  onWallet: boolean | null;
};

export async function getSettingsState(): Promise<SettingsState> {
  const user = await requireUser();
  const ctx = await getFamilyContext();
  const supabase = await createClient();
  const base: SettingsState = { email: user.email, kind: "none", family: null, guardianLabel: null, kidName: null, hasWallet: false, payments: null };
  if (ctx.kind === "signed_out") return base;

  if (ctx.kind === "kid") {
    const [{ data: family }, { data: kid }] = await Promise.all([
      supabase.from("families").select("name").eq("id", ctx.familyId).maybeSingle(),
      supabase.from("kids").select("name").eq("id", ctx.kidId).maybeSingle(),
    ]);
    return { ...base, kind: "kid", family: family ? { id: ctx.familyId, name: family.name } : null, kidName: kid?.name ?? null };
  }

  const { data: wallet } = await supabase.from("wallets").select("id").eq("user_id", user.id).maybeSingle();
  const hasWallet = Boolean(wallet);
  if (ctx.kind === "none") return { ...base, hasWallet };

  const [{ data: family }, { data: kids }] = await Promise.all([
    supabase.from("families").select("name,sqril_customer_id").eq("id", ctx.familyId).maybeSingle(),
    supabase.from("kids").select("id,name,avatar_id,shop_pay_enabled").eq("family_id", ctx.familyId).order("created_at"),
  ]);
  return {
    ...base,
    kind: "guardian",
    family: family ? { id: ctx.familyId, name: family.name } : null,
    guardianLabel: isGuardianLabel(ctx.label) ? ctx.label : "Parent",
    hasWallet,
    payments: {
      customerIdMasked: family?.sqril_customer_id ? maskCustomerId(family.sqril_customer_id) : null,
      kids: (kids ?? []).map((k) => ({ id: k.id, name: k.name, avatarId: k.avatar_id, shopPayEnabled: Boolean(k.shop_pay_enabled) })),
    },
  };
}

/**
 * Is this browser's key one of the signed-in user's registered devices, and
 * (from the chain, not the rows) does it hold a role on their wallet? The
 * rows can say yes to the first and the chain no to the second: the wallet
 * was created on another device, and only that device's key is its root.
 */
export async function getDeviceState(pubkey: string): Promise<DeviceState> {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: device }, { data: wallet }] = await Promise.all([
    supabase.from("devices").select("id").eq("pubkey", pubkey).maybeSingle(),
    supabase.from("wallets").select("swig_address").eq("user_id", user.id).maybeSingle(),
  ]);
  let onWallet: boolean | null = null;
  if (wallet) {
    try {
      const swig = await loadWallet(getConnection(), new PublicKey(wallet.swig_address));
      onWallet = roleIdOrNull(swig, new PublicKey(pubkey)) !== null;
    } catch {
      onWallet = null;
    }
  }
  return { registered: Boolean(device), deviceId: device?.id ?? null, onWallet };
}

export async function renameFamily(name: string): Promise<Result> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can rename the family." };
  const check = validateFamilyName(name);
  if (!check.ok) return check;
  const supabase = await createClient();
  const { error } = await supabase.from("families").update({ name: check.name }).eq("id", ctx.familyId);
  if (error) return { ok: false, error: "Couldn't rename the family. Try again." };
  return { ok: true };
}

export async function setGuardianLabel(label: GuardianLabel): Promise<Result> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can change this." };
  if (!isGuardianLabel(label)) return { ok: false, error: "Pick Parent or Guardian." };
  // guardians has select and insert policies only; the admin client writes, scoped to this guardian's own row.
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "Settings can't be saved right now." };
  const { error } = await admin.from("guardians").update({ label }).eq("user_id", ctx.userId).eq("family_id", ctx.familyId);
  if (error) return { ok: false, error: "Couldn't save that. Try again." };
  return { ok: true };
}

/** Register the parent with Sqril (KYC) and store the customer id on the family. */
export async function enablePayments(kyc: KycInput): Promise<Result<{ customerIdMasked: string }>> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can switch on payments." };
  const result = await registerFamilyForPayments(ctx.familyId, kyc, getSqrilClient(), getSupabaseAdmin());
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, customerIdMasked: maskCustomerId(result.customerId) };
}

/** Let one kid pay shops, or stop them. Needs the family registered first. */
export async function setKidPayments(kidId: string, enabled: boolean): Promise<Result> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can change this." };
  const supabase = await createClient();
  if (enabled) {
    const { data: family } = await supabase.from("families").select("sqril_customer_id").eq("id", ctx.familyId).maybeSingle();
    if (!family?.sqril_customer_id) return { ok: false, error: "Switch on payments for the family first." };
  }
  const { data, error } = await supabase.from("kids").update({ shop_pay_enabled: enabled }).eq("id", kidId).eq("family_id", ctx.familyId).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't save that. Try again." };
  return { ok: true };
}
