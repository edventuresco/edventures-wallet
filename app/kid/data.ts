import { getAccount } from "@solana/spl-token";
import type { GoalView } from "@/components/kid/GoalScreen";
import { DEFAULTS } from "@/lib/family/defaults";
import type { Split } from "@/lib/family/jars";
import { buildKidHomeView, type KidHomeView } from "@/lib/family/kid-home";
import { unitsToDisplay } from "@/lib/money/usdc";
import { ataFor } from "@/lib/family/onchain";
import { getFamilyContext } from "@/lib/family/session";
import { getConnection } from "@/lib/solana/connection";
import { createClient } from "@/lib/supabase/server";

const JARS = ["spend", "save", "share"] as const;

async function balanceOf(walletAddress: string | undefined): Promise<bigint> {
  if (!walletAddress) return 0n;
  return getAccount(getConnection(), ataFor(walletAddress))
    .then((a) => a.amount)
    .catch(() => 0n);
}

/**
 * Everything the kid home needs, for the kid whose paired device is asking.
 * RLS scopes every query to the family; the kid id comes from the device.
 * Returns null when the caller is not an active kid device.
 */
export async function getKidHome(): Promise<KidHomeView | null> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return null;
  const supabase = await createClient();

  const [{ data: kid }, { data: family }, { data: wallets }, { data: contacts }, { data: limits }, { data: allowance }, { data: events }] =
    await Promise.all([
      supabase.from("kids").select("id,name,avatar_id,owl_name").eq("id", ctx.kidId).single(),
      supabase.from("families").select("timezone").eq("id", ctx.familyId).single(),
      supabase.from("wallets").select("kind,wallet_address").eq("kid_id", ctx.kidId),
      supabase.from("contacts").select("id,label,avatar_id,address,weekly_limit_units,status").eq("kid_id", ctx.kidId).order("created_at"),
      supabase.from("limits").select("daily_limit_units").eq("kid_id", ctx.kidId).maybeSingle(),
      supabase.from("allowances").select("amount_units,next_run_at").eq("kid_id", ctx.kidId).maybeSingle(),
      supabase
        .from("events")
        .select("id,kind,amount_units,counterparty,summary,reason,created_at")
        .eq("kid_id", ctx.kidId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
  if (!kid) return null;

  const address = (kind: string) => wallets?.find((w) => w.kind === kind)?.wallet_address;
  const [spend, save, share] = await Promise.all(JARS.map((kind) => balanceOf(address(kind))));

  return buildKidHomeView({
    now: new Date(),
    timeZone: family?.timezone ?? DEFAULTS.timezone,
    kid,
    jars: { spend, save, share },
    dailyLimitUnits: BigInt(limits?.daily_limit_units ?? Number(DEFAULTS.kidDailyUnits)),
    contacts: contacts ?? [],
    allowance: allowance ?? null,
    events: events ?? [],
  });
}

/** The save jar, the spend money it can draw from, and the kid's one goal, for app/kid/goal. */
export async function getKidGoal(): Promise<{ saveDisplay: string; saveUnits: string; spendDisplay: string; spendUnits: string; goal: GoalView | null } | null> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return null;
  const supabase = await createClient();
  const [{ data: wallets }, { data: goal }] = await Promise.all([
    supabase.from("wallets").select("kind,wallet_address").eq("kid_id", ctx.kidId).in("kind", ["spend", "save"]),
    supabase.from("savings_goals").select("title,emoji,target_units").eq("kid_id", ctx.kidId).maybeSingle(),
  ]);
  const address = (kind: string) => wallets?.find((w) => w.kind === kind)?.wallet_address;
  const [save, spend] = await Promise.all([balanceOf(address("save")), balanceOf(address("spend"))]);
  return {
    saveDisplay: unitsToDisplay(save),
    saveUnits: save.toString(),
    spendDisplay: unitsToDisplay(spend),
    spendUnits: spend.toString(),
    goal: goal ? { title: goal.title, emoji: goal.emoji, targetUnits: String(goal.target_units) } : null,
  };
}

/** Last week's split and the next allowance, for app/kid/split. */
export async function getKidSplit(): Promise<{ split: Split; allowanceDisplay: string; allowanceUnits: string } | null> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return null;
  const supabase = await createClient();
  const [{ data: kid }, { data: allowance }] = await Promise.all([
    supabase.from("kids").select("spend_pct,save_pct,share_pct").eq("id", ctx.kidId).single(),
    supabase.from("allowances").select("amount_units").eq("kid_id", ctx.kidId).maybeSingle(),
  ]);
  if (!kid) return null;
  const units = BigInt(allowance?.amount_units ?? 0);
  return {
    split: { spend: kid.spend_pct, save: kid.save_pct, share: kid.share_pct },
    allowanceDisplay: unitsToDisplay(units),
    allowanceUnits: units.toString(),
  };
}
