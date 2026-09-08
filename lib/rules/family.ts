import type { SupabaseClient } from "@supabase/supabase-js";
import { AVATARS } from "@/lib/avatars";

/** The signed-in guardian's family, scoped by RLS (one row or none). */
export type FamilyRow = { id: string; name: string; timezone: string };

export async function currentFamily(supabase: SupabaseClient): Promise<FamilyRow | null> {
  const { data } = await supabase.from("families").select("id,name,timezone").limit(1).maybeSingle();
  return (data as FamilyRow | null) ?? null;
}

export type KidRow = { id: string; name: string; avatar_id: string; birth_month: number | null; birth_year: number | null };

export async function familyKids(supabase: SupabaseClient, familyId: string): Promise<KidRow[]> {
  const { data } = await supabase.from("kids").select("id,name,avatar_id,birth_month,birth_year").eq("family_id", familyId).order("created_at");
  return (data as KidRow[] | null) ?? [];
}

const SPECIAL_EMOJI: Record<string, string> = { parent: "💛", family: "🏡", shop: "🛍️" };

/** Emoji for an avatar id. Illustrated avatars have no emoji, so they and unknown ids fall back. */
export function avatarEmoji(avatarId: string): string {
  return AVATARS.find((a) => a.id === avatarId)?.emoji ?? SPECIAL_EMOJI[avatarId] ?? "🧒";
}

/** "Monday 14 Sep, 09:00" in the family timezone. */
export function dateTimeLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(instant)
    .replace(/,? at /, ", ");
}
