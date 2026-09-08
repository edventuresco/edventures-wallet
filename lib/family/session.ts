import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";

export type FamilyContext =
  | { kind: "guardian"; userId: string; familyId: string; label: string }
  | { kind: "kid"; userId: string; familyId: string; kidId: string; deviceId: string }
  | { kind: "none"; userId: string }
  | { kind: "signed_out" };

/** Who is asking: a guardian, an active kid device, a signed-in user with no family, or nobody. */
export async function getFamilyContext(): Promise<FamilyContext> {
  const user = await getUser();
  if (!user) return { kind: "signed_out" };
  const supabase = await createClient();
  const { data: guardian } = await supabase.from("guardians").select("family_id,label").eq("user_id", user.id).maybeSingle();
  if (guardian) return { kind: "guardian", userId: user.id, familyId: guardian.family_id, label: guardian.label };
  const { data: device } = await supabase
    .from("devices")
    .select("id,family_id,kid_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .not("kid_id", "is", null)
    .maybeSingle();
  if (device?.kid_id && device.family_id) return { kind: "kid", userId: user.id, familyId: device.family_id, kidId: device.kid_id, deviceId: device.id };
  return { kind: "none", userId: user.id };
}
