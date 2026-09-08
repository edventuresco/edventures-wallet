-- Applied to the Edventures Wallet project on 2026-09-08 via the Supabase MCP (name: waitlist_status).
--
-- Beta access. A waitlist row is waiting, accepted or declined. Only an
-- accepted email (or an admin, lib/waitlist/access.ts) may create an account
-- from /login; existing accounts sign in as before. /admin flips the status.
alter table public.waitlist
  add column status text not null default 'waiting' check (status in ('waiting', 'accepted', 'declined')),
  add column status_changed_at timestamptz;

create index waitlist_status_created_idx on public.waitlist (status, created_at desc);
