-- A pairing code is a device row that has no auth user yet; the kid's
-- anonymous user claims it when the code is typed.
alter table public.devices alter column user_id drop not null;
