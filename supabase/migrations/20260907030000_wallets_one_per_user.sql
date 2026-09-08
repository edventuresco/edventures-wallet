-- Applied to the Edventures Wallet project on 2026-09-07 via the Supabase MCP (name: wallets_one_per_user).
-- One wallet per user in slice 0; a concurrent second create loses the race.
alter table public.wallets add constraint wallets_user_id_key unique (user_id);
