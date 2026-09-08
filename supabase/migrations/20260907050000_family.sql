-- Applied to the Edventures Wallet project on 2026-09-07 via the Supabase MCP (name: family_model).
-- Slice 2: families, guardians, kids, kid devices, jars, rules, contacts,
-- allowances, requests. Extends the slice-0 tables in place.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our family',
  timezone text not null default 'Asia/Kuching',
  sqril_customer_id text,
  created_at timestamptz not null default now()
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  label text not null default 'Parent' check (label in ('Parent', 'Guardian')),
  created_at timestamptz not null default now()
);

create table public.kids (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  avatar_id text not null default 'otter',
  birth_month smallint check (birth_month between 1 and 12),
  birth_year smallint check (birth_year between 2000 and 2030),
  owl_name text,
  spend_pct smallint not null default 50 check (spend_pct between 0 and 100),
  save_pct smallint not null default 40 check (save_pct between 0 and 100),
  share_pct smallint not null default 10 check (share_pct between 0 and 100),
  created_at timestamptz not null default now(),
  constraint kids_split_sums_to_100 check (spend_pct + save_pct + share_pct = 100)
);

-- Devices: a guardian's device (user_id = the guardian) or a kid's device
-- (user_id = the anonymous auth user created on that device at pairing).
alter table public.devices
  add column family_id uuid references public.families(id) on delete cascade,
  add column kid_id uuid references public.kids(id) on delete cascade,
  add column role_id integer,
  add column pairing_code text,
  add column pairing_expires_at timestamptz;
create index devices_family_idx on public.devices (family_id);
create unique index devices_pairing_code_idx on public.devices (pairing_code) where pairing_code is not null;

-- Wallets: personal (slice 0), family treasury, or a kid's spend / save / share jar.
alter table public.wallets
  alter column user_id drop not null,
  drop constraint wallets_user_id_key,
  add column family_id uuid references public.families(id) on delete cascade,
  add column kid_id uuid references public.kids(id) on delete cascade,
  add column kind text not null default 'personal' check (kind in ('personal', 'family', 'spend', 'save', 'share'));
create unique index wallets_one_personal_per_user on public.wallets (user_id) where kid_id is null and kind in ('personal', 'family');
create unique index wallets_one_kind_per_kid on public.wallets (kid_id, kind) where kid_id is not null;
create index wallets_family_idx on public.wallets (family_id);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  label text not null,
  avatar_id text not null default 'person',
  address text not null,
  weekly_limit_units bigint not null default 50000000,
  status text not null default 'requested' check (status in ('active', 'requested', 'removed')),
  onchain_synced boolean not null default false,
  created_at timestamptz not null default now(),
  unique (kid_id, address)
);

-- One limits row per member: kid_id null means the guardian's own wallet.
create table public.limits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kid_id uuid references public.kids(id) on delete cascade,
  daily_limit_units bigint not null,
  weekly_limit_units bigint not null,
  approval_threshold_units bigint not null default 20000000,
  pending_raise jsonb,
  allowed_programs text[] not null default '{}',
  onchain_synced boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index limits_one_per_member on public.limits (family_id, coalesce(kid_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.allowances (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kid_id uuid not null unique references public.kids(id) on delete cascade,
  amount_units bigint not null,
  cadence text not null default 'weekly' check (cadence in ('weekly')),
  next_run_at timestamptz not null,
  last_paid_at timestamptz,
  keeper_role_id integer,
  updated_at timestamptz not null default now()
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null unique references public.kids(id) on delete cascade,
  title text not null,
  emoji text not null default '🎯',
  target_units bigint not null,
  created_at timestamptz not null default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  type text not null check (type in ('add_contact', 'approve_send', 'share')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'used')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index requests_family_status_idx on public.requests (family_id, status, created_at desc);

alter table public.events
  add column family_id uuid references public.families(id) on delete cascade,
  add column kid_id uuid references public.kids(id) on delete cascade;
alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check check (kind in ('wallet_created', 'funded', 'sent', 'received', 'blocked', 'allowance', 'split', 'saved', 'shared', 'shop_paid', 'shop_failed', 'contact_added', 'device_paired', 'badge'));
create index events_family_created_idx on public.events (family_id, created_at desc);

-- Who am I in a family? A guardian (by user) or an active kid device (by the
-- device's auth user). Every family-scoped policy funnels through this.
create or replace function public.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.guardians where user_id = auth.uid()
  union all
  select family_id from public.devices where user_id = auth.uid() and status = 'active' and kid_id is not null
  limit 1
$$;

create or replace function public.current_kid_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select kid_id from public.devices where user_id = auth.uid() and status = 'active' and kid_id is not null limit 1
$$;

create or replace function public.is_guardian()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.guardians where user_id = auth.uid())
$$;

alter table public.families enable row level security;
alter table public.guardians enable row level security;
alter table public.kids enable row level security;
alter table public.contacts enable row level security;
alter table public.limits enable row level security;
alter table public.allowances enable row level security;
alter table public.savings_goals enable row level security;
alter table public.requests enable row level security;

-- Guardians manage everything in their family; a kid device reads its family
-- and its own rows, writes only requests and its own split.
create policy families_member_select on public.families for select using (id = public.current_family_id());
create policy families_guardian_update on public.families for update using (id = public.current_family_id() and public.is_guardian());
create policy families_insert_any_signed_in on public.families for insert with check (auth.uid() is not null);

create policy guardians_member_select on public.guardians for select using (family_id = public.current_family_id());
create policy guardians_self_insert on public.guardians for insert with check (user_id = auth.uid());

create policy kids_member_select on public.kids for select using (family_id = public.current_family_id());
create policy kids_guardian_write on public.kids for all using (family_id = public.current_family_id() and public.is_guardian()) with check (family_id = public.current_family_id() and public.is_guardian());
create policy kids_self_update_split on public.kids for update using (id = public.current_kid_id()) with check (id = public.current_kid_id());

create policy contacts_member_select on public.contacts for select using (family_id = public.current_family_id());
create policy contacts_guardian_write on public.contacts for all using (family_id = public.current_family_id() and public.is_guardian()) with check (family_id = public.current_family_id() and public.is_guardian());

create policy limits_member_select on public.limits for select using (family_id = public.current_family_id());
create policy limits_guardian_write on public.limits for all using (family_id = public.current_family_id() and public.is_guardian()) with check (family_id = public.current_family_id() and public.is_guardian());

create policy allowances_member_select on public.allowances for select using (family_id = public.current_family_id());
create policy allowances_guardian_write on public.allowances for all using (family_id = public.current_family_id() and public.is_guardian()) with check (family_id = public.current_family_id() and public.is_guardian());

create policy goals_member_select on public.savings_goals for select using (kid_id in (select id from public.kids where family_id = public.current_family_id()));
create policy goals_member_write on public.savings_goals for all using (kid_id = public.current_kid_id() or (public.is_guardian() and kid_id in (select id from public.kids where family_id = public.current_family_id()))) with check (kid_id = public.current_kid_id() or (public.is_guardian() and kid_id in (select id from public.kids where family_id = public.current_family_id())));

create policy requests_member_select on public.requests for select using (family_id = public.current_family_id());
create policy requests_kid_insert on public.requests for insert with check (kid_id = public.current_kid_id() and family_id = public.current_family_id());
create policy requests_guardian_update on public.requests for update using (family_id = public.current_family_id() and public.is_guardian());

-- Slice-0 tables gain family scope alongside their own-row policies.
create policy devices_family_select on public.devices for select using (family_id = public.current_family_id());
create policy devices_guardian_write on public.devices for all using (family_id = public.current_family_id() and public.is_guardian()) with check (family_id = public.current_family_id() and public.is_guardian());
create policy wallets_family_select on public.wallets for select using (family_id = public.current_family_id());
create policy events_family_select on public.events for select using (family_id = public.current_family_id());
create policy events_kid_insert on public.events for insert with check (family_id = public.current_family_id() and (public.is_guardian() or kid_id = public.current_kid_id()));

-- Realtime for the kid's device: allowance arrived, request decided.
alter publication supabase_realtime add table public.events, public.requests;
