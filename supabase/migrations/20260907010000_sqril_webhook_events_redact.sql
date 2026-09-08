-- Applied to the Edventures Wallet project on 2026-09-07 via the Supabase MCP (name: sqril_webhook_events_redact).
-- Sqril webhooks include the sender's KYC record. Store a hash of the raw
-- body for auditing and a redacted payload; never the identity fields.
alter table public.sqril_webhook_events
  alter column raw_body drop not null,
  add column if not exists raw_sha256 text;

-- Scrub what was recorded before redaction existed (test data, but the rule
-- starts now).
update public.sqril_webhook_events
set raw_body = null,
    payload = case when payload is null then null else (payload - 'sender') end;

comment on column public.sqril_webhook_events.raw_sha256 is 'SHA-256 of the exact raw body as delivered (signature was verified over that body).';
comment on column public.sqril_webhook_events.raw_body is 'Unused since redaction; kept nullable for the migration history.';
