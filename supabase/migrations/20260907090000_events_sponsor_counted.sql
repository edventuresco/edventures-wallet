-- Applied to the Edventures Wallet project on 2026-09-07 (via the Supabase MCP).
-- or `supabase db push`) before releasing lib/sponsor/policy.ts from this change
-- and before running `npm run demo:reset` without --dry-run.
--
-- The 10-a-day sponsorship cap (lib/sponsor/policy.ts countSponsoredToday)
-- counts only rows where sponsor_counted is true. A demo reset flips today's
-- rows to false so the family gets a fresh ten without deleting the on-chain
-- history the guardian wants to show. A not-null column with a constant
-- default is a metadata-only change (no table rewrite), and the existing
-- events_user_created_idx (user_id, created_at desc) still serves the count.
alter table public.events add column sponsor_counted boolean not null default true;
comment on column public.events.sponsor_counted is 'Counts toward the daily sponsorship cap. The demo reset sets it false; the row and its signature stay.';
