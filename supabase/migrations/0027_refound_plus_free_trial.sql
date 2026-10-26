-- One server-controlled ReFound+ trial per account/email. The unique claim row
-- remains after expiry, so expired access can never be restarted by calling the RPC again.
alter table public.refound_plus_entitlements
  drop constraint refound_plus_entitlements_source_check;
alter table public.refound_plus_entitlements
  add constraint refound_plus_entitlements_source_check
  check (source in ('MANUAL', 'PAYMENT', 'TRIAL'));

create table public.refound_plus_trial_claims (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_at_claim text not null,
  claimed_at timestamptz not null default now(),
  ends_at timestamptz not null,
  constraint refound_plus_trial_dates_valid check (ends_at = claimed_at + interval '24 hours')
);
create unique index refound_plus_trial_email_once_idx
  on public.refound_plus_trial_claims (lower(email_at_claim));
alter table public.refound_plus_trial_claims enable row level security;
revoke all on public.refound_plus_trial_claims from public, anon, authenticated;

create or replace function public.get_my_refound_plus_trial_status()
returns table (eligible boolean, claimed_at timestamptz, ends_at timestamptz, reason text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_claim public.refound_plus_trial_claims%rowtype;
begin
  if v_user_id is null then raise exception 'Sign in to check trial eligibility'; end if;
  if public.is_admin(v_user_id) then
    return query select false, null::timestamptz, null::timestamptz, 'ADMIN_INCLUDED'::text;
    return;
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_user_id;
  select c.* into v_claim from public.refound_plus_trial_claims c
    where c.user_id = v_user_id or lower(c.email_at_claim) = v_email
    limit 1;
  if found then
    return query select false, v_claim.claimed_at, v_claim.ends_at, 'ALREADY_USED'::text;
    return;
  end if;
  if not public.campus_access_allowed(v_user_id) then
    return query select false, null::timestamptz, null::timestamptz, 'CAMPUS_VERIFICATION_REQUIRED'::text;
    return;
  end if;
  if exists (
    select 1 from public.refound_plus_entitlements e where e.user_id = v_user_id
      and e.status = 'ACTIVE' and (e.starts_at is null or e.starts_at <= now())
      and (e.ends_at is null or e.ends_at > now())
  ) then
    return query select false, null::timestamptz, null::timestamptz, 'ACTIVE_MEMBERSHIP'::text;
    return;
  end if;
  if exists (
    select 1 from public.refound_plus_payment_requests r where r.user_id = v_user_id
      and r.status in ('AWAITING_PAYMENT', 'PENDING_REVIEW')
  ) then
    return query select false, null::timestamptz, null::timestamptz, 'PENDING_PAYMENT'::text;
    return;
  end if;
  return query select true, null::timestamptz, null::timestamptz, 'AVAILABLE'::text;
end;
$$;

create or replace function public.claim_refound_plus_free_trial()
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_now timestamptz := now();
  v_ends_at timestamptz := now() + interval '24 hours';
  v_rows integer;
begin
  if v_user_id is null then raise exception 'Sign in to start your free trial'; end if;
  if public.is_admin(v_user_id) then raise exception 'ReFound+ is already included for admin accounts'; end if;
  if not public.campus_access_allowed(v_user_id) then raise exception 'Verify your campus account before starting a trial'; end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_user_id;
  if v_email is null then raise exception 'Could not verify your account email'; end if;
  if exists (
    select 1 from public.refound_plus_entitlements e where e.user_id = v_user_id
      and e.status = 'ACTIVE' and (e.starts_at is null or e.starts_at <= v_now)
      and (e.ends_at is null or e.ends_at > v_now)
  ) then raise exception 'Your ReFound+ membership is already active'; end if;
  if exists (
    select 1 from public.refound_plus_payment_requests r where r.user_id = v_user_id
      and r.status in ('AWAITING_PAYMENT', 'PENDING_REVIEW')
  ) then raise exception 'Resolve or cancel your pending payment request before starting a trial'; end if;

  insert into public.refound_plus_trial_claims(user_id, email_at_claim, claimed_at, ends_at)
    values (v_user_id, v_email, v_now, v_ends_at)
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'This account has already used its ReFound+ free trial'; end if;

  insert into public.refound_plus_entitlements(user_id, status, source, starts_at, ends_at)
    values (v_user_id, 'ACTIVE', 'TRIAL', v_now, v_ends_at)
    on conflict (user_id) do update set
      status = 'ACTIVE', source = 'TRIAL', starts_at = excluded.starts_at,
      ends_at = excluded.ends_at, updated_at = now();

  return v_ends_at;
end;
$$;

revoke all on function public.get_my_refound_plus_trial_status() from public, anon;
revoke all on function public.claim_refound_plus_free_trial() from public, anon;
grant execute on function public.get_my_refound_plus_trial_status() to authenticated;
grant execute on function public.claim_refound_plus_free_trial() to authenticated;
