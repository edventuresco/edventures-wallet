import { redirect } from "next/navigation";
import { WaitlistAdmin } from "@/components/admin/WaitlistAdmin";
import { GuardianShell } from "@/components/family/GuardianShell";
import { getUser } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/waitlist/access";
import { getWaitlist } from "./actions";

export const metadata = { title: "Waitlist" };
export const dynamic = "force-dynamic";

/** Not linked from any nav; the admin accounts visit /admin directly. Everyone else is sent home. */
export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/");
  const rows = await getWaitlist();
  return (
    <GuardianShell>
      <WaitlistAdmin initial={rows} />
    </GuardianShell>
  );
}
