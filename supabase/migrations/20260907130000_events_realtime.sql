-- Applied to the Edventures Wallet project on 2026-09-07 (via the Supabase MCP).
-- an allowance landing, money arriving, someone new on the list.
--
-- The family migration (20260907050000) already put public.events in the
-- supabase_realtime publication on the live project, and adding a table twice
-- is an error, so the add is guarded. Replica identity full puts the whole
-- row in every payload, so the kid side can read kind and summary without a
-- second query.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    execute 'alter publication supabase_realtime add table public.events';
  end if;
end
$$;

alter table public.events replica identity full;
