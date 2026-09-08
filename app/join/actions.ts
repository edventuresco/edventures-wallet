"use server";

// The kid's side of an invite. The parent invited this email; the kid is now
// signed in with it on this device. Nothing to type: the invite is matched
// by email and this device joins the kid, waiting for the guardian's
// on-chain approval.

import { requireUser } from "@/lib/auth/session";
import { isValidPubkey } from "@/lib/device/key";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type AcceptInviteResult =
  | { ok: true; kidName: string; status: "pending" | "active" }
  | { ok: false; reason: "no_invite" | "no_device" | "unavailable"; error: string };

/** Which kid this signed-in user is: an accepted invite, an open invite for their email, or an earlier device. */
async function kidFor(userId: string, email: string | null): Promise<{ kidId: string; familyId: string; inviteId: string | null } | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data: device } = await admin.from("devices").select("kid_id,family_id").eq("user_id", userId).not("kid_id", "is", null).limit(1).maybeSingle();
  if (device?.kid_id && device.family_id) return { kidId: device.kid_id, familyId: device.family_id, inviteId: null };
  if (!email) return null;
  const { data: invite } = await admin
    .from("kid_invites")
    .select("id,kid_id,family_id,expires_at,accepted_at,accepted_user_id")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!invite) return null;
  if (invite.accepted_at && invite.accepted_user_id !== userId) return null;
  if (!invite.accepted_at && new Date(invite.expires_at) < new Date()) return null;
  return { kidId: invite.kid_id, familyId: invite.family_id, inviteId: invite.accepted_at ? null : invite.id };
}

/** Does this signed-in user have a kid invite waiting? Used to route them to /join. */
export async function hasKidInvite(): Promise<boolean> {
  const user = await requireUser();
  return (await kidFor(user.id, user.email)) !== null;
}

/** Join the family the invite points at, with this device's key. Safe to call again. */
export async function acceptInvite(pubkey: string): Promise<AcceptInviteResult> {
  const user = await requireUser();
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, reason: "unavailable", error: "Joining isn't available right now." };
  if (!isValidPubkey(pubkey)) return { ok: false, reason: "no_device", error: "This device isn't ready. Reload and try again." };
  const match = await kidFor(user.id, user.email);
  if (!match) return { ok: false, reason: "no_invite", error: "Ask a grown-up to invite you from their Edventures Wallet first." };
  const { data: kid } = await admin.from("kids").select("name").eq("id", match.kidId).single();
  const { data: existing } = await admin.from("devices").select("id,status").eq("user_id", user.id).eq("pubkey", pubkey).maybeSingle();
  if (!existing) {
    const { error } = await admin
      .from("devices")
      .insert({ user_id: user.id, family_id: match.familyId, kid_id: match.kidId, pubkey, label: "Kid device", status: "pending" });
    if (error) return { ok: false, reason: "unavailable", error: "Couldn't join. Try again." };
  }
  if (match.inviteId) await admin.from("kid_invites").update({ accepted_at: new Date().toISOString(), accepted_user_id: user.id }).eq("id", match.inviteId);
  return { ok: true, kidName: kid?.name ?? "you", status: existing?.status === "active" ? "active" : "pending" };
}
