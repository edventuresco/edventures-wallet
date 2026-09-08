"use server";

// The waitlist, for the admin accounts in lib/waitlist/access.ts only. The
// table has no RLS policies, so every read and write goes through the
// service role after the caller's email is checked.

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAdminEmail, isWaitlistStatus, type WaitlistStatus } from "@/lib/waitlist/access";

type Result = { ok: true } | { ok: false; error: string };

export type WaitlistRow = {
  id: string;
  email: string;
  country: string | null;
  kids: number | null;
  status: WaitlistStatus;
  createdAt: string;
  statusChangedAt: string | null;
};

const MOST_ROWS = 500;

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) redirect("/");
  return user;
}

export async function getWaitlist(): Promise<WaitlistRow[]> {
  await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data } = await admin.from("waitlist").select("id,email,country,kids,status,created_at,status_changed_at").order("created_at", { ascending: false }).limit(MOST_ROWS);
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    country: row.country ?? null,
    kids: row.kids ?? null,
    status: isWaitlistStatus(row.status) ? row.status : "waiting",
    createdAt: row.created_at,
    statusChangedAt: row.status_changed_at ?? null,
  }));
}

export async function setWaitlistStatus(id: string, status: WaitlistStatus): Promise<Result> {
  await requireAdmin();
  if (!isWaitlistStatus(status)) return { ok: false, error: "That isn't a status." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "The waitlist isn't available right now." };
  const { error } = await admin.from("waitlist").update({ status, status_changed_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update that row. Try again." };
  return { ok: true };
}
