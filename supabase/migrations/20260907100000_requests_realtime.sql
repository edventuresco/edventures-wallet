-- Applied to the Edventures Wallet project on 2026-09-07 (via the Supabase MCP).
--
-- The family migration (20260907050000) already put public.requests in the
-- supabase_realtime publication on the live project, and adding a table twice
-- is an error, so the add is guarded. Replica identity full makes the old row
-- (its status, in particular) part of every update and delete payload, so
-- the badge can tell a decision from an approved request being used.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'
  ) then
    execute 'alter publication supabase_realtime add table public.requests';
  end if;
end
$$;

alter table public.requests replica identity full;
