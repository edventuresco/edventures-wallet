import Link from "next/link";
import type { FeedItem, FeedTone } from "@/lib/family/feed";

const TONE: Record<FeedTone, string> = {
  plain: "text-ink",
  blocked: "text-terracotta-dark",
  allowance: "text-forest",
};

/**
 * What happened in the family, newest first (spec: family home, "current
 * priorities"). Adult palette. Pure presentation: the page or section that
 * mounts it loads the items with `getFamilyFeed` in app/family/feed-actions.ts.
 */
export function FamilyFeed({ items, seeAllHref, title = "What happened" }: { items: FeedItem[]; seeAllHref?: string; title?: string }) {
  return (
    <section className="space-y-3" aria-labelledby="family-feed-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="family-feed-heading" className="text-xl text-forest">
          {title}
        </h2>
        {seeAllHref && items.length > 0 && (
          <Link href={seeAllHref} className="text-sm font-semibold text-forest underline underline-offset-2">
            See all
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-[22px] border border-sand-dark bg-white p-5 text-sm text-ink/60">Nothing yet. Sends, allowances and stops show up here as they happen.</p>
      ) : (
        <ul className="divide-y divide-sand-dark rounded-[22px] border border-sand-dark bg-white shadow-sm" role="list">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-5 py-3">
              <span className="text-2xl leading-8" aria-hidden>
                {item.kidEmoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${TONE[item.tone]}`}>
                  <span className="sr-only">{item.kidName}: </span>
                  {item.summary}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink/60">
                  <span>{item.whenLabel}</span>
                  {item.proofUrl && (
                    <a href={item.proofUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-forest">
                      Proof
                      <span className="sr-only"> on Solana, opens in a new tab</span>
                    </a>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
