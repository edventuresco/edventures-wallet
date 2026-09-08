import Link from "next/link";

/** What a kid screen shows when this device is not an active kid device yet. */
export function NotPaired() {
  return (
    <section className="space-y-4 rounded-3xl bg-white px-6 py-8 text-center ring-1 ring-sand-dark">
      <span aria-hidden="true" className="text-5xl">
        🦉
      </span>
      <h1 className="font-display text-[26px] font-semibold leading-8 text-kid-green">This device isn&apos;t set up yet</h1>
      <p className="text-base leading-6 text-ink/80">Ask a grown-up to invite you from their phone. Then open the email on this device and you&apos;re in.</p>
      <Link href="/login" className="inline-flex h-12 items-center rounded-2xl bg-kid-orange px-6 text-lg font-bold text-white">
        I have an invite
      </Link>
    </section>
  );
}
