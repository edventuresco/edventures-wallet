"use server";

import { validateGoal, validateSplit, type GoalInput, type Split } from "@/lib/family/jars";
import { getFamilyContext } from "@/lib/family/session";
import { createClient } from "@/lib/supabase/server";

export type JarResult = { ok: true } | { ok: false; error: string };

/** The kid sets or changes their one savings goal. RLS (goals_member_write) allows the kid's own row. */
export async function saveGoal(input: GoalInput): Promise<JarResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, error: "Only your own device can set your goal." };
  const check = validateGoal(input);
  if (!check.ok) return check;
  const supabase = await createClient();
  const { error } = await supabase
    .from("savings_goals")
    .upsert({ kid_id: ctx.kidId, title: check.goal.title, emoji: check.goal.emoji, target_units: Number(check.goal.targetUnits) }, { onConflict: "kid_id" });
  if (error) return { ok: false, error: "Couldn't save your goal. Try again." };
  return { ok: true };
}

/** The kid decides how next week's allowance splits. RLS (kids_self_update_split) allows the kid's own row. */
export async function saveSplit(input: Split): Promise<JarResult> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "kid") return { ok: false, error: "Only your own device can change your split." };
  const check = validateSplit(input);
  if (!check.ok) return check;
  const supabase = await createClient();
  const { error } = await supabase
    .from("kids")
    .update({ spend_pct: check.split.spend, save_pct: check.split.save, share_pct: check.split.share })
    .eq("id", ctx.kidId);
  if (error) return { ok: false, error: "Couldn't save your split. Try again." };
  return { ok: true };
}
