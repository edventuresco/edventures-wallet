-- Applied to the Edventures Wallet project on 2026-09-07 (via the Supabase MCP).
-- A kid device spends the guardian's yes once the send lands: it may move
-- its own approved `approve_send` request to `used`, and nothing else.
-- Until this is applied, app/kid/actions.ts marks the request used through
-- the service role.

create policy requests_kid_mark_used on public.requests
  for update
  using (kid_id = public.current_kid_id() and status = 'approved')
  with check (kid_id = public.current_kid_id() and status = 'used');
