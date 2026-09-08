"use server";

import { getAccount } from "@solana/spl-token";
import { DEFAULTS } from "@/lib/family/defaults";
import { buildKidDetailView, JARS, type JarKind, type KidDetailView } from "@/lib/family/kid-detail";
import { ataFor } from "@/lib/family/onchain";
import { getFamilyContext } from "@/lib/family/session";
import { toView, type MoneyView } from "@/lib/money/usdc";
import { usdcBalanceOf } from "@/lib/solana/balance";
import { getConnection } from "@/lib/solana/connection";
import { createClient } from "@/lib/supabase/server";

async function balanceOf(walletAddress: string | undefined): Promise<bigint> {
  if (!walletAddress) return 0n;
  return getAccount(getConnection(), ataFor(walletAddress))
    .then((a) => a.amount)
    .catch(() => 0n);
}

/**
 * Everything the kid-detail page renders, balances read from Solana like the
 * family home. Guardians only; null when the kid is not in their family.
 */
export async function getKidDetail(kidId: string): Promise<KidDetailView | null> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return null;
  const supabase = await createClient();
  const { data: kid } = await supabase.from("kids").select("id,name,avatar_id,birth_month,birth_year").eq("id", kidId).eq("family_id", ctx.familyId).maybeSingle();
  if (!kid) return null;

  const [{ data: family }, { data: wallets }, { data: devices }, { data: allowance }, { data: contacts }, { data: limits }, { data: events }] = await Promise.all([
    supabase.from("families").select("timezone").eq("id", ctx.familyId).single(),
    supabase.from("wallets").select("kind,wallet_address").eq("kid_id", kid.id),
    supabase.from("devices").select("status,user_id").eq("kid_id", kid.id),
    supabase.from("allowances").select("amount_units,next_run_at").eq("kid_id", kid.id).maybeSingle(),
    supabase.from("contacts").select("id,label,avatar_id,weekly_limit_units,status,onchain_synced").eq("kid_id", kid.id).eq("status", "active").order("created_at"),
    supabase.from("limits").select("daily_limit_units,weekly_limit_units,approval_threshold_units,pending_raise,onchain_synced").eq("kid_id", kid.id).maybeSingle(),
    supabase.from("events").select("id,summary,signature,created_at").eq("kid_id", kid.id).order("created_at", { ascending: false }).limit(10),
  ]);

  const address = (kind: JarKind) => wallets?.find((w) => w.kind === kind)?.wallet_address;
  const [spend, save, share] = await Promise.all(JARS.map((kind) => balanceOf(address(kind))));

  return buildKidDetailView({
    now: new Date(),
    timeZone: family?.timezone ?? DEFAULTS.timezone,
    kid,
    wallets: wallets ?? [],
    balances: { spend, save, share },
    devices: (devices ?? []).map((d) => ({ status: d.status, joined: Boolean(d.user_id) })),
    allowance: allowance ?? null,
    contacts: contacts ?? [],
    limits: limits ?? null,
    events: events ?? [],
  });
}

export type AddMoneyContext = {
  kid: { id: string; name: string };
  /** The kid's spend jar on Solana; null until their wallets exist. */
  spendAddress: string | null;
  familyBalance: MoneyView | null;
};

/** What the Add money page needs. Null when the kid is not in this guardian's family. */
export async function getAddMoneyContext(kidId: string): Promise<AddMoneyContext | null> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return null;
  const supabase = await createClient();
  const [{ data: kid }, { data: spend }, { data: familyWallet }] = await Promise.all([
    supabase.from("kids").select("id,name").eq("id", kidId).eq("family_id", ctx.familyId).maybeSingle(),
    supabase.from("wallets").select("wallet_address").eq("kid_id", kidId).eq("kind", "spend").maybeSingle(),
    supabase.from("wallets").select("wallet_address").eq("family_id", ctx.familyId).eq("kind", "family").maybeSingle(),
  ]);
  if (!kid) return null;
  const balance = familyWallet ? await usdcBalanceOf(familyWallet.wallet_address) : null;
  return { kid: { id: kid.id, name: kid.name }, spendAddress: spend?.wallet_address ?? null, familyBalance: balance === null ? null : toView(balance) };
}
