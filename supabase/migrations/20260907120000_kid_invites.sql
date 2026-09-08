-- A parent invites a kid by email. The kid signs up through the emailed link
-- (or with a code sent to that email) and the account joins the family on
-- its own: no pairing code, no second code. The guardian's device still
-- signs the on-chain approval of the kid's device afterwards.
create table public.kid_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null
);
create index kid_invites_email_idx on public.kid_invites (lower(email)) where accepted_at is null;
create index kid_invites_kid_idx on public.kid_invites (kid_id, created_at desc);
alter table public.kid_invites enable row level security;
create policy kid_invites_guardian_all on public.kid_invites
  for all using (family_id = public.current_family_id() and public.is_guardian())
  with check (family_id = public.current_family_id() and public.is_guardian());
