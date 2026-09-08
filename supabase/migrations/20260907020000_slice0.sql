-- Applied to the Edventures Wallet project on 2026-09-07 via the Supabase MCP (name: slice0_devices_wallets_events).
-- Slice 0: one person, their devices, their wallet, what happened.
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pubkey text not null unique,
  label text not null default 'This device',
  status text not null default 'active' check (status in ('active', 'pending', 'revoked')),
  created_at timestamptz not null default now()
);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  swig_address text not null unique,
  wallet_address text not null unique,
  root_device_id uuid not null references public.devices(id),
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid references public.wallets(id) on delete set null,
  kind text not null check (kind in ('wallet_created', 'funded', 'sent', 'blocked')),
  amount_units bigint,
  counterparty text,
  signature text,
  reason text,
  summary text not null,
  created_at timestamptz not null default now()
);
create index events_user_created_idx on public.events (user_id, created_at desc);

alter table public.devices enable row level security;
alter table public.wallets enable row level security;
alter table public.events enable row level security;

create policy devices_own on public.devices for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wallets_own on public.wallets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy events_own on public.events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
