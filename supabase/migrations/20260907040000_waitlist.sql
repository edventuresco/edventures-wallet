-- Applied to the Edventures Wallet project on 2026-09-07 via the Supabase MCP (name: waitlist).
-- Landing-page waitlist sign-ups. RLS is enabled with no policies: only the
-- service role (server actions) reads or writes this table.
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null unique,
  kids smallint check (kids between 1 and 6),
  source text not null default 'landing',
  user_agent text,
  created_at timestamptz default now()
);

alter table public.waitlist enable row level security;
