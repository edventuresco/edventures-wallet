import Link from "next/link";
import { redirect } from "next/navigation";
import { FamilyFeed } from "@/components/family/FamilyFeed";
import { FEED_PAGE, getFamilyFeed } from "../feed-actions";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const pageLink = "rounded-2xl border border-forest px-4 py-2 text-sm font-semibold text-forest hover:bg-sand";

/** Everything that happened in the family, 50 at a time, newest first. */
export default async function FamilyActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  const feed = await getFamilyFeed({ limit: FEED_PAGE, offset: (page - 1) * FEED_PAGE });
  if (!feed) redirect("/family");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-forest">Activity</h1>
        <p className="mt-1 text-ink/70">Every send, allowance, save, share and stop, in family time. Proof links open Solana.</p>
      </div>
      <FamilyFeed items={feed.items} title={page > 1 ? `Page ${page}` : "Newest first"} />
      <nav aria-label="Pages" className="flex justify-between">
        {page > 1 ? (
          <Link href={page === 2 ? "/family/activity" : `/family/activity?page=${page - 1}`} className={pageLink}>
            Newer
          </Link>
        ) : (
          <span />
        )}
        {feed.hasMore && (
          <Link href={`/family/activity?page=${page + 1}`} className={pageLink}>
            Older
          </Link>
        )}
      </nav>
    </div>
  );
}
