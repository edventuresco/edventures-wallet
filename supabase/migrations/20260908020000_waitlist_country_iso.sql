-- Applied to the Edventures Wallet project on 2026-09-08 via the Supabase MCP (name: waitlist_country_iso).
--
-- Country becomes an ISO 3166-1 alpha-2 code picked from a select, not free
-- text. No row had a country when this ran; lib/waitlist/countries.ts is the
-- assigned-code list and turns codes back into names.
alter table public.waitlist
  drop constraint waitlist_country_check,
  add constraint waitlist_country_check check (country ~ '^[A-Z]{2}$');
