-- NOT APPLIED. Apply with the Supabase MCP or the CLI, then update this line.
--
-- The grown-up's own events (wallet created, funded, sent, blocked) used to
-- carry only user_id and wallet_id, so the family activity feed, which
-- filters on family_id, never showed them. New rows now carry family_id
-- (app/wallet/actions.ts recordOwnerEvent); this backfills the old ones for
-- every guardian so the feed reads the same before and after.

update public.events e
set family_id = g.family_id
from public.guardians g
where e.user_id = g.user_id
  and e.family_id is null
  and e.kid_id is null;
