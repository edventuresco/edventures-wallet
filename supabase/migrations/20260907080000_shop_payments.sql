-- Applied to the Edventures Wallet project on 2026-09-07 (via the Supabase MCP).
-- (name: shop_payments) or the CLI, then update this header.
--
-- "Pay a shop": one row per Sqril quote a kid device took to the Pay button.
-- The row is created at quote time (status quoted), moves to paid_onchain once
-- the kid's spend jar has paid the family treasury on Solana, to processing
-- once Sqril accepted the payout, and settles to success or failed from the
-- signed webhook (or a status poll that asked Sqril directly).
--
-- Money columns are USDC base units (bigint), never dollars. amount_local is
-- the merchant's currency as Sqril quoted it (VND has no decimals; others may).

create table public.shop_payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  -- The kid device's auth user at quote time: what events.user_id needs when
  -- the webhook (which has no session) records the outcome.
  user_id uuid references auth.users(id) on delete set null,
  sqril_tx_id text not null unique,
  merchant text not null,
  country text not null default '',
  currency text not null default '',
  amount_local numeric not null check (amount_local > 0),
  amount_usd_units bigint not null check (amount_usd_units >= 0),
  fee_usd_units bigint not null check (fee_usd_units >= 0),
  total_usd_units bigint not null check (total_usd_units > 0),
  signature text,
  status text not null default 'quoted' check (status in ('quoted', 'paid_onchain', 'processing', 'success', 'failed')),
  failure_reason text,
  -- Sqril holds a quote for about 30 minutes; we refuse to move money on a
  -- quote that is about to lapse rather than strand it in the treasury.
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The unique constraint above already backs lookups by sqril_tx_id (webhook,
-- status poll); this named index makes that explicit and survives if the
-- constraint is ever relaxed.
create index shop_payments_sqril_tx_id_idx on public.shop_payments (sqril_tx_id);
-- Today's shop spend per kid, and the family's history.
create index shop_payments_kid_created_idx on public.shop_payments (kid_id, created_at desc);
create index shop_payments_family_created_idx on public.shop_payments (family_id, created_at desc);

alter table public.shop_payments enable row level security;

-- Every family member can see the family's shop payments; guardians manage
-- them; a kid device creates and advances only its own rows.
create policy shop_payments_member_select on public.shop_payments
  for select using (family_id = public.current_family_id());
create policy shop_payments_guardian_all on public.shop_payments
  for all using (family_id = public.current_family_id() and public.is_guardian())
  with check (family_id = public.current_family_id() and public.is_guardian());
create policy shop_payments_kid_insert on public.shop_payments
  for insert with check (kid_id = public.current_kid_id() and family_id = public.current_family_id());
create policy shop_payments_kid_update on public.shop_payments
  for update using (kid_id = public.current_kid_id())
  with check (kid_id = public.current_kid_id());

comment on table public.shop_payments is
  'One row per "pay a shop" quote a kid took to Pay. Amounts in USDC base units; sqril_tx_id is the Sqril transaction and the webhook key.';
comment on column public.shop_payments.signature is
  'Solana signature of the kid spend jar → family treasury transfer; doubles as the Sqril idempotency key.';
