-- Applied to the Edventures Wallet project on 2026-09-07 via the Supabase MCP (name: sqril_webhook_events).
-- Raw audit trail of every Sqril webhook delivery, signed or not.
-- Written only by the server (service role); no client policies.
create table if not exists public.sqril_webhook_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  tx_id text,
  status text,
  signature_present boolean not null default false,
  signature_valid boolean not null default false,
  user_agent text,
  raw_body text not null,
  payload jsonb,
  processed_at timestamptz,
  note text
);

create index if not exists sqril_webhook_events_tx_id_idx on public.sqril_webhook_events (tx_id);
create index if not exists sqril_webhook_events_received_at_idx on public.sqril_webhook_events (received_at desc);

alter table public.sqril_webhook_events enable row level security;

comment on table public.sqril_webhook_events is
  'Every inbound Sqril webhook as delivered. Service-role writes only; signature_valid says whether X-SQRIL-Signature matched.';
