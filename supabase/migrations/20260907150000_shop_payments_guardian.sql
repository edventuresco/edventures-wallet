-- NOT APPLIED. Apply with the Supabase MCP or the CLI, then update this line.
--
-- A parent can pay a shop from the family wallet (app/pay/actions.ts). Such
-- a row has no kid: kid_id becomes nullable. The kid policies compare
-- kid_id to the current kid and so never match a parent's row; the guardian
-- policy already covers the family's rows. Kids still cannot insert a row
-- without their own kid_id.

alter table public.shop_payments alter column kid_id drop not null;

comment on table public.shop_payments is
  'One row per "pay a shop" quote taken to Pay: a kid''s (kid_id) or a parent''s from the family wallet (kid_id null). Amounts in USDC base units; sqril_tx_id is the Sqril transaction and the webhook key.';
