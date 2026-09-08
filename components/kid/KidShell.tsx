import { KidLive } from "@/components/kid/KidLive";
import { KidNav } from "@/components/kid/KidNav";
import { getFamilyContext } from "@/lib/family/session";
import { createClient } from "@/lib/supabase/server";

type PairedKid = { kidId: string; parentLabel: string };

/** The paired kid behind this device, with how they call their guardian; null for anyone else. */
async function pairedKid(): Promise<PairedKid | null> {
  try {
    const ctx = await getFamilyContext();
    if (ctx.kind !== "kid") return null;
    const supabase = await createClient();
    const [{ data: parent }, { data: guardian }] = await Promise.all([
      supabase.from("contacts").select("label").eq("kid_id", ctx.kidId).eq("avatar_id", "parent").limit(1).maybeSingle(),
      supabase.from("guardians").select("label").eq("family_id", ctx.familyId).limit(1).maybeSingle(),
    ]);
    return { kidId: ctx.kidId, parentLabel: parent?.label ?? (guardian?.label === "Guardian" ? "Guardian" : "Mum") };
  } catch {
    // No Supabase env (a bare checkout) means no session: show the page without the nav.
    return null;
  }
}

/**
 * The kid side's shell: sand canvas, safe-area top inset, content capped at
 * phone width, and, once this device is a paired kid, the bottom nav plus
 * the live listener that reacts to a guardian's yes or an allowance.
 * Content clears the nav by the spec's 96px.
 */
export async function KidShell({ children }: { children: React.ReactNode }) {
  const kid = await pairedKid();
  return (
    <div className="min-h-dvh bg-sand">
      <main
        className={`mx-auto max-w-md px-5 pb-8 sm:px-6 ${kid ? "pb-[calc(96px+env(safe-area-inset-bottom))]" : ""}`}
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 24px)" }}
      >
        {children}
      </main>
      {kid && <KidNav />}
      {kid && <KidLive kidId={kid.kidId} parentLabel={kid.parentLabel} />}
    </div>
  );
}
