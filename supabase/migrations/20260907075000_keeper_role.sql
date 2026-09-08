-- Applied to the Edventures Wallet project on 2026-09-07 (via the Supabase MCP).
-- The keeper role: the server's fee payer key holds a limited role on the
-- family treasury (a weekly USDC cap, any destination) so allowances can be
-- paid on a schedule. Null until the guardian turns automatic allowance on.
alter table public.families add column keeper_role_id integer;
