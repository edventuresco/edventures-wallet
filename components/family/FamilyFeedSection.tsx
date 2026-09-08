import { FEED_PREVIEW, getFamilyFeed } from "@/app/family/feed-actions";
import { FamilyFeed } from "./FamilyFeed";

/**
 * The feed with its data: the newest 12 events and a "See all" link. An
 * async server component, so pass it as a node into a client screen
 * (e.g. `<FamilySetup feed={<FamilyFeedSection />} />`). Renders nothing
 * until the family exists.
 */
export async function FamilyFeedSection() {
  const feed = await getFamilyFeed({ limit: FEED_PREVIEW });
  if (!feed) return null;
  return <FamilyFeed items={feed.items} title="Family activity" seeAllHref={feed.hasMore || feed.items.length > 0 ? "/family/activity" : undefined} />;
}
