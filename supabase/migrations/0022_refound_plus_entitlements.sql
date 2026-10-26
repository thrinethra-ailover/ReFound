-- ReFound+ membership state. Payment integration is intentionally separate:
-- browser clients may read their own status but can never grant or alter it.
create table public.refound_plus_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'INACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'EXPIRED', 'REVOKED')),
  source text not null default 'MANUAL' check (source in ('MANUAL', 'PAYMENT')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refound_plus_entitlement_dates_valid check (ends_at is null or starts_at is null or ends_at > starts_at)
);

comment on table public.refound_plus_entitlements is
  'Server-managed ReFound+ entitlement state. Payment provider integration is pending; clients cannot write to this table.';

create index refound_plus_entitlements_active_idx
  on public.refound_plus_entitlements(user_id, ends_at)
  where status = 'ACTIVE';

alter table public.refound_plus_entitlements enable row level security;
revoke all on public.refound_plus_entitlements from anon, authenticated;
grant select on public.refound_plus_entitlements to authenticated;

create policy refound_plus_entitlements_select_own
  on public.refound_plus_entitlements for select to authenticated
  using (user_id = auth.uid());

create policy refound_plus_entitlements_select_admin
  on public.refound_plus_entitlements for select to authenticated
  using (public.is_admin());

-- No INSERT, UPDATE, or DELETE policies are granted to browser users.
-- A future verified payment webhook can maintain entitlements using the
-- server-only service role after payment-provider setup.
