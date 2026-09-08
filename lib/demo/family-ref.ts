// Resolving the `--family` argument the demo scripts share: a families.id, or
// the sign-in email of one of the family's guardians. Service role I/O; used
// by scripts/demo-reset.ts and scripts/demo-seed.ts.

import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FamilyRef = {
  familyId: string;
  /** The guardian named by email, when `--family` was an email; null for an id. */
  guardianUserId: string | null;
};

export async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const res = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (res.error) throw new Error(`auth.admin.listUsers: ${res.error.message}`);
    const hit = res.data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (!res.data.nextPage) return null;
  }
}

/** Throws with a clear message when the id or email does not lead to a family. `usage` is appended when the argument is malformed. */
export async function resolveFamilyRef(admin: SupabaseClient, ref: string, usage: string): Promise<FamilyRef> {
  if (UUID.test(ref)) {
    const res = await admin.from("families").select("id").eq("id", ref).maybeSingle();
    if (res.error) throw new Error(`families: ${res.error.message}`);
    if (!res.data) throw new Error(`No family with id ${ref}.`);
    return { familyId: ref, guardianUserId: null };
  }
  const email = ref.toLowerCase();
  if (!email.includes("@")) throw new Error(`--family must be a family id or a guardian's email, got "${ref}".\n\n${usage}`);
  const userId = await findUserIdByEmail(admin, email);
  if (!userId) throw new Error(`No sign-in with the email ${email}.`);
  const res = await admin.from("guardians").select("family_id").eq("user_id", userId).maybeSingle();
  if (res.error) throw new Error(`guardians: ${res.error.message}`);
  if (!res.data) throw new Error(`${email} is signed up but is not a guardian of any family yet.`);
  return { familyId: res.data.family_id as string, guardianUserId: userId };
}
