import { feedItemFrom, type FeedEventRow, type FeedItem } from "@/lib/family/feed";
import { ownerNameOf } from "@/lib/family/owner";
import { getFamilyContext } from "@/lib/family/session";
import { getUser } from "@/lib/auth/session";
import { currentFamily, familyKids } from "@/lib/rules/family";
import { createClient } from "@/lib/supabase/server";

export const FEED_PREVIEW = 12;
export const FEED_PAGE = 50;

export type FamilyFeedPage = { items: FeedItem[]; hasMore: boolean };

/**
 * The family's newest events, for the signed-in guardian: the kids' moves
 * and the guardian's own (rows with no kid, labelled with their name). RLS
 * scopes the rows to the family. `offset` pages through the full list;
 * `hasMore` says whether an older page exists. Null when there is no
 * family yet.
 */
export async function getFamilyFeed(opts: { limit?: number; offset?: number } = {}): Promise<FamilyFeedPage | null> {
  const ctx = await getFamilyContext();
  if (ctx.kind !== "guardian") return null;
  const supabase = await createClient();
  const family = await currentFamily(supabase);
  if (!family) return null;
  const limit = opts.limit ?? FEED_PREVIEW;
  const offset = opts.offset ?? 0;
  const [kids, user, { data }] = await Promise.all([
    familyKids(supabase, family.id),
    getUser(),
    supabase
      .from("events")
      .select("id,kid_id,kind,summary,signature,created_at")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit),
  ]);
  const rows = (data as FeedEventRow[] | null) ?? [];
  const now = new Date();
  return {
    items: rows.slice(0, limit).map((row) => feedItemFrom(row, kids, now, family.timezone, { ownerName: ownerNameOf(user) })),
    hasMore: rows.length > limit,
  };
}
