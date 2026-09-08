-- Applied to the Edventures Wallet project on 2026-09-07 (via the Supabase MCP).
-- registered the family with Sqril (families.sqril_customer_id, from
-- Settings), they switch "Pay a shop" on for each kid. Off by default, so a
-- kid can never pay a shop the family never opted into.

alter table public.kids add column shop_pay_enabled boolean not null default false;
