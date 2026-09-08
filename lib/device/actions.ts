"use server";

import bs58 from "bs58";
import { requireUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DeviceOwner = "mine" | "free" | "other";

/**
 * Whose registered device a key is: the signed-in user's, nobody's, or
 * another account's. Reads with the service role because RLS hides other
 * users' device rows, and "free" must not be a guess. Nothing about the
 * other account is returned.
 */
export async function whoseDevice(pubkey: string): Promise<DeviceOwner> {
  const user = await requireUser();
  const client = getSupabaseAdmin() ?? (await createClient());
  const { data } = await client.from("devices").select("user_id").eq("pubkey", pubkey).maybeSingle();
  if (!data) return "free";
  return data.user_id === user.id ? "mine" : "other";
}

export async function registerDevice(pubkey: string): Promise<{ ok: true; deviceId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  try {
    if (bs58.decode(pubkey).length !== 32) throw new Error();
  } catch {
    return { ok: false, error: "That doesn't look like a device key." };
  }
  const supabase = await createClient();
  const { data: existing } = await supabase.from("devices").select("id").eq("pubkey", pubkey).maybeSingle();
  if (existing) return { ok: true, deviceId: existing.id };
  const { data, error } = await supabase.from("devices").insert({ user_id: user.id, pubkey, label: "This device" }).select("id").single();
  if (error?.code === "23505") {
    return { ok: false, error: "This browser's key already belongs to another account. Sign out of that account first, or use a different browser." };
  }
  if (error || !data) return { ok: false, error: "Couldn't register this device. Try again." };
  return { ok: true, deviceId: data.id };
}
