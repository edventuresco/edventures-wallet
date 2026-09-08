-- Applied to the Edventures Wallet project on 2026-09-08 via the Supabase MCP (name: goals).
--
-- Family goals: sub-savings accounts for trips, activities and other things
-- the family saves toward. A goal belongs to everyone (kid_id null) or to
-- one kid. Money in a goal is set aside, not moved: each contribution
-- earmarks part of its contributor's own balance (a guardian's share of the
-- family wallet; later a kid's save jar). Saved = the unreleased
-- contributions. A guardian may release ("take back") any contribution.
-- The kid's own jar goal (savings_goals, one per kid) is a separate thing.
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kid_id uuid references public.kids(id) on delete cascade,
  title text not null,
  emoji text not null default '🎯',
  kind text not null default 'other' check (kind in ('trip', 'activity', 'other')),
  target_units bigint not null check (target_units > 0),
  target_date date,
  created_by uuid not null references auth.users(id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index goals_family_idx on public.goals (family_id, archived_at, created_at);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kid_id uuid references public.kids(id) on delete cascade,
  contributor_name text not null,
  amount_units bigint not null check (amount_units > 0),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  constraint goal_contributions_one_contributor check ((user_id is null) <> (kid_id is null))
);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id, released_at);
create index goal_contributions_family_idx on public.goal_contributions (family_id, released_at);

alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;

create policy goals_member_select on public.goals for select using (family_id = public.current_family_id());
create policy goals_guardian_write on public.goals for all
  using (public.is_guardian() and family_id = public.current_family_id())
  with check (public.is_guardian() and family_id = public.current_family_id());

create policy goal_contributions_member_select on public.goal_contributions for select using (family_id = public.current_family_id());
create policy goal_contributions_guardian_write on public.goal_contributions for all
  using (public.is_guardian() and family_id = public.current_family_id())
  with check (public.is_guardian() and family_id = public.current_family_id());
-- A kid device may add its own contribution (the kid-side flow is later work).
create policy goal_contributions_kid_insert on public.goal_contributions for insert
  with check (kid_id = public.current_kid_id() and family_id = public.current_family_id());
