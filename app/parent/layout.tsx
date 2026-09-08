import Link from "next/link";

export const metadata = { title: "Parent" };

export default function ParentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-sand">
      <header className="bg-forest text-sand">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
          <Link href="/parent" className="font-display text-xl">
            Edventures Wallet
          </Link>
          <span className="rounded-full bg-forest-light px-3 py-1 text-xs uppercase tracking-wide">
            Parent
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-md px-6 py-6">{children}</main>
    </div>
  );
}
