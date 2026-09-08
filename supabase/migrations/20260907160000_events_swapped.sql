-- NOT APPLIED. Apply with the Supabase MCP or the CLI, then update this line.
--
-- A swap between the family's dollar and SOL (app/swap/actions.ts) gets its
-- own event kind. Until this is applied the action records a swap as sent
-- or received so the feed still shows it.

alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check check (kind in ('wallet_created', 'funded', 'sent', 'received', 'blocked', 'allowance', 'split', 'saved', 'shared', 'shop_paid', 'shop_failed', 'contact_added', 'device_paired', 'badge', 'swapped'));
