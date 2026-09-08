"use server";

// Family goals (lib/family/goals.ts) and, below, the kids' own jar goals.
// Reads and writes go through the guardian's own session; RLS scopes them
// to the family. Setting money aside is an earmark on the family wallet,
// not a transfer, so nothing here touches Solana beyond reading balances.

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/session";
import { closedLabel, GOAL_KIND_META, goalOwnerLabel, goalSummary, isGoalKind, setAsideAvailable, targetDateLabel, validateGoalDraft, validateSetAside, type Contribution, type ContributorShare, type GoalDraft, type GoalKind } from "@/lib/family/goals";
import { goalProgress, type GoalProgress } from "@/lib/family/jars";
import { ownerNameOf } from "@/lib/family/owner";
import { getFamilyContext } from "@/lib/family/session";
import { toView, unitsToDisplay, type MoneyView } from "@/lib/money/usdc";
import { avatarEmoji, currentFamily, dateTimeLabel, familyKids } from "@/lib/rules/family";
import { usdcBalanceOf } from "@/lib/solana/balance";
import { createClient } from "@/lib/supabase/server";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type GoalListItem = {
  id: string;
  title: string;
  emoji: string;
  kind: GoalKind;
  art: string | null;
  /** "Family goal" or "Mia's goal". */
  ownerLabel: string;
  kidId: string | null;
  targetDisplay: string;
  savedDisplay: string;
  progress: GoalProgress;
  targetDateLabel: string | null;
  participants: Array<{ name: string; emoji: string }>;
};

export type ClosedGoalItem = {
  id: string;
  title: string;
  emoji: string;
  ownerLabel: string;
  /** "Closed 8 Sep 2026". */
  closedLabel: string;
};

export type GoalsPageData = {
  goals: GoalListItem[];
  /** Goals a guardian stopped. Their money is free again; any can be reopened. */
  closedGoals: ClosedGoalItem[];
  kids: Array<{ id: string; name: string }>;
  /** The family wallet, what is set aside across goals, and what is still free. */
  wallet: { balance: MoneyView; setAside: MoneyView; free: MoneyView } | null;
  jarGoals: KidGoalView[];
};

export type GoalDetail = GoalListItem & {
  targetDate: string | null;
  blurb: string;
  contributors: Array<Pick<ContributorShare, "key" | "name" | "display" | "percent" | "percentLabel">>;
  /** Every contribution, newest first, with what a guardian may do to it. */
  contributions: Array<{ id: string; name: string; display: string; whenLabel: string; released: boolean }>;
  free: MoneyView;
  kids: Array<{ id: string; name: string }>;
};

type GoalRow = { id: string; kid_id: string | null; title: string; emoji: string; kind: string; target_units: number; target_date: string | null; created_at: string };
type ContributionRow = { id: string; goal_id: string; user_id: string | null; kid_id: string | null; contributor_name: string; amount_units: number; released_at: string | null; created_at: string };

function toContribution(row: ContributionRow): Contribution {
  return { id: row.id, userId: row.user_id, kidId: row.kid_id, name: row.contributor_name, units: BigInt(row.amount_units), releasedAt: row.released_at, createdAt: row.created_at };
}

async function familyWalletUnits(supabase: Awaited<ReturnType<typeof createClient>>, familyId: string): Promise<bigint | null> {
  const { data } = await supabase.from("wallets").select("wallet_address").eq("family_id", familyId).eq("kind", "family").maybeSingle();
  return data ? usdcBalanceOf(data.wallet_address) : null;
}

/** Everything the guardian's Goals page shows. Null when there is no family. */
export async function getGoalsPage(): Promise<GoalsPageData | null> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return null;
  const supabase = await createClient();
  const family = await currentFamily(supabase);
  if (!family) return null;
  const [kids, { data: goalRows }, { data: closedRows }, { data: contributionRows }, walletUnits, jarGoals] = await Promise.all([
    familyKids(supabase, family.id),
    supabase.from("goals").select("id,kid_id,title,emoji,kind,target_units,target_date,created_at").eq("family_id", family.id).is("archived_at", null).order("created_at"),
    supabase.from("goals").select("id,kid_id,title,emoji,archived_at").eq("family_id", family.id).not("archived_at", "is", null).order("archived_at", { ascending: false }),
    supabase.from("goal_contributions").select("id,goal_id,user_id,kid_id,contributor_name,amount_units,released_at,created_at").eq("family_id", family.id).is("released_at", null),
    familyWalletUnits(supabase, family.id),
    getJarGoals(),
  ]);
  const contributions = ((contributionRows as ContributionRow[] | null) ?? []).map(toContribution);
  const kidName = (id: string | null) => kids.find((k) => k.id === id)?.name ?? null;
  const goals = ((goalRows as GoalRow[] | null) ?? []).map((g) => {
    const kind = isGoalKind(g.kind) ? g.kind : "other";
    const mine = new Set(((contributionRows as ContributionRow[] | null) ?? []).filter((r) => r.goal_id === g.id).map((r) => r.id));
    const summary = goalSummary(contributions.filter((c) => mine.has(c.id)), BigInt(g.target_units));
    return {
      id: g.id,
      title: g.title,
      emoji: g.emoji,
      kind,
      art: GOAL_KIND_META[kind].art,
      ownerLabel: goalOwnerLabel(kidName(g.kid_id)),
      kidId: g.kid_id,
      targetDisplay: unitsToDisplay(BigInt(g.target_units)),
      savedDisplay: summary.savedDisplay,
      progress: summary.progress,
      targetDateLabel: targetDateLabel(g.target_date),
      participants: summary.contributors.map((c) => ({ name: c.name, emoji: c.key.startsWith("kid:") ? avatarEmoji(kids.find((k) => `kid:${k.id}` === c.key)?.avatar_id ?? "otter") : "🧑" })),
    };
  });
  const earmarked = contributions.filter((c) => c.userId).reduce((sum, c) => sum + c.units, 0n);
  const closedGoals = ((closedRows as Array<Pick<GoalRow, "id" | "kid_id" | "title" | "emoji"> & { archived_at: string }> | null) ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    emoji: g.emoji,
    ownerLabel: goalOwnerLabel(kidName(g.kid_id)),
    closedLabel: closedLabel(g.archived_at, family.timezone),
  }));
  return {
    goals,
    closedGoals,
    kids: kids.map((k) => ({ id: k.id, name: k.name })),
    wallet: walletUnits === null ? null : { balance: toView(walletUnits), setAside: toView(earmarked), free: toView(setAsideAvailable({ familyWalletUnits: walletUnits, earmarkedUnits: earmarked })) },
    jarGoals: jarGoals ?? [],
  };
}

/** One goal, per the shared-goal page: progress, who put in what, and the history. Null when it is not this family's. */
export async function getGoal(goalId: string): Promise<GoalDetail | null> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return null;
  const supabase = await createClient();
  const family = await currentFamily(supabase);
  if (!family) return null;
  const [{ data: g }, { data: rows }, kids, walletUnits, { data: earmarkRows }] = await Promise.all([
    supabase.from("goals").select("id,kid_id,title,emoji,kind,target_units,target_date,created_at").eq("family_id", family.id).eq("id", goalId).is("archived_at", null).maybeSingle(),
    supabase.from("goal_contributions").select("id,goal_id,user_id,kid_id,contributor_name,amount_units,released_at,created_at").eq("goal_id", goalId).order("created_at", { ascending: false }),
    familyKids(supabase, family.id),
    familyWalletUnits(supabase, family.id),
    supabase.from("goal_contributions").select("amount_units").eq("family_id", family.id).is("released_at", null).not("user_id", "is", null),
  ]);
  if (!g) return null;
  const goal = g as GoalRow;
  const kind = isGoalKind(goal.kind) ? goal.kind : "other";
  const contributions = ((rows as ContributionRow[] | null) ?? []).map(toContribution);
  const summary = goalSummary(contributions, BigInt(goal.target_units));
  const earmarked = (earmarkRows ?? []).reduce((sum, r) => sum + BigInt(r.amount_units), 0n);
  const kid = kids.find((k) => k.id === goal.kid_id);
  return {
    id: goal.id,
    title: goal.title,
    emoji: goal.emoji,
    kind,
    art: GOAL_KIND_META[kind].art,
    ownerLabel: goalOwnerLabel(kid?.name ?? null),
    kidId: goal.kid_id,
    targetDisplay: unitsToDisplay(BigInt(goal.target_units)),
    savedDisplay: summary.savedDisplay,
    progress: summary.progress,
    targetDate: goal.target_date,
    targetDateLabel: targetDateLabel(goal.target_date),
    blurb: GOAL_KIND_META[kind].blurb,
    participants: summary.contributors.map((c) => ({ name: c.name, emoji: c.key.startsWith("kid:") ? avatarEmoji(kids.find((k) => `kid:${k.id}` === c.key)?.avatar_id ?? "otter") : "🧑" })),
    contributors: summary.contributors.map(({ key, name, display, percent, percentLabel }) => ({ key, name, display, percent, percentLabel })),
    contributions: contributions.map((c) => ({ id: c.id, name: c.name, display: unitsToDisplay(c.units), whenLabel: dateTimeLabel(new Date(c.createdAt), family.timezone), released: Boolean(c.releasedAt) })),
    free: toView(walletUnits === null ? 0n : setAsideAvailable({ familyWalletUnits: walletUnits, earmarkedUnits: earmarked })),
    kids: kids.map((k) => ({ id: k.id, name: k.name })),
  };
}

export async function createGoal(draft: GoalDraft): Promise<Result<{ goalId: string }>> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can start a goal." };
  const check = validateGoalDraft(draft, new Date());
  if (!check.ok) return check;
  const supabase = await createClient();
  if (check.goal.kidId) {
    const kids = await familyKids(supabase, ctx.familyId);
    if (!kids.some((k) => k.id === check.goal.kidId)) return { ok: false, error: "That kid isn't in your family." };
  }
  const { data, error } = await supabase
    .from("goals")
    .insert({ family_id: ctx.familyId, kid_id: check.goal.kidId, title: check.goal.title, emoji: check.goal.emoji, kind: check.goal.kind, target_units: Number(check.goal.targetUnits), target_date: check.goal.targetDate, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't start the goal. Try again." };
  revalidatePath("/goals");
  return { ok: true, goalId: data.id };
}

export async function updateGoal(goalId: string, draft: GoalDraft): Promise<Result> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can change a goal." };
  const check = validateGoalDraft(draft, new Date());
  if (!check.ok) return check;
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ kid_id: check.goal.kidId, title: check.goal.title, emoji: check.goal.emoji, kind: check.goal.kind, target_units: Number(check.goal.targetUnits), target_date: check.goal.targetDate })
    .eq("id", goalId)
    .eq("family_id", ctx.familyId);
  if (error) return { ok: false, error: "Couldn't save the goal. Try again." };
  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  return { ok: true };
}

/** Stopping a goal releases every contribution: the money was never moved, so it is simply free again. The goal stays, closed, and can be reopened. */
export async function archiveGoal(goalId: string): Promise<Result> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can close a goal." };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("goals").update({ archived_at: now }).eq("id", goalId).eq("family_id", ctx.familyId);
  if (error) return { ok: false, error: "Couldn't close the goal. Try again." };
  await supabase.from("goal_contributions").update({ released_at: now }).eq("goal_id", goalId).is("released_at", null);
  revalidatePath("/goals");
  return { ok: true };
}

/** Open a closed goal again. What was set aside before stayed free when it closed, so it starts from what is saved now: nothing. */
export async function reopenGoal(goalId: string): Promise<Result> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can reopen a goal." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").update({ archived_at: null }).eq("id", goalId).eq("family_id", ctx.familyId).not("archived_at", "is", null).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't reopen the goal. Try again." };
  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  return { ok: true };
}

/** Set part of the family wallet aside for this goal, in the guardian's name. */
export async function setAside(goalId: string, dollars: string): Promise<Result> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can set money aside." };
  const user = await getUser();
  const supabase = await createClient();
  const [{ data: goal }, walletUnits, { data: earmarkRows }] = await Promise.all([
    supabase.from("goals").select("id").eq("id", goalId).eq("family_id", ctx.familyId).is("archived_at", null).maybeSingle(),
    familyWalletUnits(supabase, ctx.familyId),
    supabase.from("goal_contributions").select("amount_units").eq("family_id", ctx.familyId).is("released_at", null).not("user_id", "is", null),
  ]);
  if (!goal) return { ok: false, error: "That goal isn't open." };
  if (walletUnits === null) return { ok: false, error: "The family wallet isn't set up yet." };
  const earmarked = (earmarkRows ?? []).reduce((sum, r) => sum + BigInt(r.amount_units), 0n);
  const check = validateSetAside(dollars, setAsideAvailable({ familyWalletUnits: walletUnits, earmarkedUnits: earmarked }));
  if (!check.ok) return check;
  const { error } = await supabase.from("goal_contributions").insert({ goal_id: goalId, family_id: ctx.familyId, user_id: ctx.userId, contributor_name: ownerNameOf(user), amount_units: Number(check.units) });
  if (error) return { ok: false, error: "Couldn't set that aside. Try again." };
  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  return { ok: true };
}

/** Take a contribution back. The money never moved, so it is free again at once. */
export async function releaseContribution(contributionId: string): Promise<Result> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return { ok: false, error: "Only a guardian can take money back." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("goal_contributions").update({ released_at: new Date().toISOString() }).eq("id", contributionId).eq("family_id", ctx.familyId).is("released_at", null).select("goal_id").maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't take that back. Try again." };
  revalidatePath("/goals");
  revalidatePath(`/goals/${data.goal_id}`);
  return { ok: true };
}

// --- The kids' own jar goals (savings_goals): set on their device, filled by their Save jar. ---

export type KidGoalView = {
  kidId: string;
  kidName: string;
  kidEmoji: string;
  savedDisplay: string;
  /** Null when the kid has not set a goal yet. */
  goal: { title: string; emoji: string; targetDisplay: string; progress: GoalProgress } | null;
};

/** Every kid's jar goal with how far their Save jar has got. Null when there is no family. */
export async function getJarGoals(): Promise<KidGoalView[] | null> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return null;
  const supabase = await createClient();
  const family = await currentFamily(supabase);
  if (!family) return null;
  const kids = await familyKids(supabase, family.id);
  if (kids.length === 0) return [];
  const ids = kids.map((k) => k.id);
  const [{ data: goals }, { data: wallets }] = await Promise.all([
    supabase.from("savings_goals").select("kid_id,title,emoji,target_units").in("kid_id", ids),
    supabase.from("wallets").select("kid_id,wallet_address").eq("kind", "save").in("kid_id", ids),
  ]);
  return Promise.all(
    kids.map(async (kid) => {
      const saved = await usdcBalanceOf(wallets?.find((w) => w.kid_id === kid.id)?.wallet_address);
      const goal = goals?.find((g) => g.kid_id === kid.id);
      const target = goal ? BigInt(goal.target_units) : 0n;
      return {
        kidId: kid.id,
        kidName: kid.name,
        kidEmoji: avatarEmoji(kid.avatar_id),
        savedDisplay: unitsToDisplay(saved),
        goal: goal ? { title: goal.title, emoji: goal.emoji, targetDisplay: unitsToDisplay(target), progress: goalProgress(saved, target) } : null,
      };
    }),
  );
}
