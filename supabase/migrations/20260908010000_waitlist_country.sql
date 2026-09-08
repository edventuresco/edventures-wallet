-- Applied to the Edventures Wallet project on 2026-09-08 via the Supabase MCP (name: waitlist_country).
--
-- Where the family lives, free-typed on the landing form. Helps plan
-- onboarding order and payment corridors; nothing filters on it, so no index.
alter table public.waitlist
  add column country text check (char_length(country) <= 80);
