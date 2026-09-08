import Link from "next/link";

/** Signed in, but this email is not accepted on the waitlist yet. */
export function NotInBeta({ email }: { email: string | null }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-3">
        <h1 className="text-4xl text-forest">Not your turn yet</h1>
        <p className="text-lg text-ink/80">
          {email ? <span className="font-semibold">{email}</span> : "This email"} isn&apos;t in the beta yet. We&apos;re letting families in a few at a time.
        </p>
      </div>
      <Link href="/#waitlist" className="rounded-2xl bg-terracotta px-6 py-4 text-center text-lg font-semibold text-white">
        Join the waitlist
      </Link>
      <form action="/logout" method="post">
        <button type="submit" className="w-full py-2 text-sm text-forest underline">
          Sign out
        </button>
      </form>
    </main>
  );
}
