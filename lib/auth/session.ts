import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
  /** The name they gave on /onboarding (auth user_metadata.display_name), if any. */
  name: string | null;
};

export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return null;
  const meta = data.claims.user_metadata as Record<string, unknown> | undefined;
  const name = typeof meta?.display_name === "string" ? meta.display_name.trim() : "";
  return { id: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : null, name: name || null };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
