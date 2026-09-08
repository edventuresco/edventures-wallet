import Link from "next/link";

/** A place that exists in the footer's world before its feature does. */
export function ComingSoon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5">
      <h1 className="text-3xl text-forest">{title}</h1>
      <p className="text-ink/70">{children}</p>
      <Link href="/" className="inline-block text-sm font-semibold text-forest underline">
        Back home
      </Link>
    </div>
  );
}
