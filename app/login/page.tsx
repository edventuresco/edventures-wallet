import { redirect } from "next/navigation";
import { EmailOtpForm } from "@/components/auth/EmailOtpForm";
import { hasKidInvite } from "@/app/join/actions";
import { getFamilyContext } from "@/lib/family/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ctx = await getFamilyContext();
  if (ctx.kind === "guardian") redirect("/");
  if (ctx.kind === "kid") redirect("/kid");
  if (ctx.kind === "none") redirect((await hasKidInvite()) ? "/join" : "/onboarding");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-4xl text-forest">Sign in to Edventures Wallet</h1>
        <p className="text-ink/80">No password. We email you a code.</p>
        {error === "link" && <p className="text-sm text-terracotta-dark">That sign-in link didn&apos;t work or expired. Request a new code below.</p>}
      </div>
      <EmailOtpForm />
      <p className="text-center text-sm text-ink/60">Beta access is by invitation from the waitlist. Kids join from a parent&apos;s invite.</p>
    </main>
  );
}
