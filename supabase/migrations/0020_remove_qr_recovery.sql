-- ReFound — retire QR recovery links and their public lookup endpoint.
-- Dropping the column also removes its unique index automatically.
drop function if exists public.get_recovery_info(uuid);

alter table public.items
  drop column if exists recovery_token;
