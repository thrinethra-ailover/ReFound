-- ReFound+ manual UPI launch: configurable checkout, review queue, and real perks.
alter table public.app_settings
  add column refound_plus_public_enabled boolean not null default false,
  add column refound_plus_upi_vpa text,
  add column refound_plus_payee_name text,
  add column refound_plus_price_inr integer,
  add column refound_plus_plan text not null default 'ONE_TIME' check (refound_plus_plan in ('ONE_TIME','SUBSCRIPTION')),
  add column refound_plus_period_days integer not null default 30 check (refound_plus_period_days between 1 and 366),
  add column refound_plus_qr_url text;

alter table public.profiles add column profile_accent text not null default 'DEFAULT'
  check (profile_accent in ('DEFAULT','TEAL','VIOLET','ROSE','AMBER','BLUE'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('refound-plus-assets','refound-plus-assets',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
create policy refound_plus_qr_public_read on storage.objects for select to anon, authenticated
  using(bucket_id='refound-plus-assets');
create policy refound_plus_qr_admin_insert on storage.objects for insert to authenticated
  with check(bucket_id='refound-plus-assets' and public.is_admin());
create policy refound_plus_qr_admin_update on storage.objects for update to authenticated
  using(bucket_id='refound-plus-assets' and public.is_admin()) with check(bucket_id='refound-plus-assets' and public.is_admin());
create policy refound_plus_qr_admin_delete on storage.objects for delete to authenticated
  using(bucket_id='refound-plus-assets' and public.is_admin());

create table public.refound_plus_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_inr integer not null check (amount_inr > 0),
  plan text not null check (plan in ('ONE_TIME','SUBSCRIPTION')),
  period_days integer not null check (period_days between 1 and 366),
  upi_vpa text,
  payee_name text not null,
  qr_url text,
  status text not null default 'AWAITING_PAYMENT' check (status in ('AWAITING_PAYMENT','PENDING_REVIEW','APPROVED','REJECTED','CANCELLED')),
  utr text unique,
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refound_plus_payment_requests_user_idx on public.refound_plus_payment_requests(user_id, created_at desc);
create index refound_plus_payment_requests_review_idx on public.refound_plus_payment_requests(status, created_at desc);
alter table public.refound_plus_payment_requests enable row level security;
revoke all on public.refound_plus_payment_requests from public, anon, authenticated;

create or replace function public.get_refound_plus_settings()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'enabled', refound_plus_public_enabled,
    'vpa', refound_plus_upi_vpa,
    'payee_name', refound_plus_payee_name,
    'price_inr', refound_plus_price_inr,
    'plan', refound_plus_plan,
    'period_days', refound_plus_period_days,
    'qr_url', refound_plus_qr_url
  ) from public.app_settings where singleton;
$$;

create or replace function public.admin_update_refound_plus_settings(
  p_enabled boolean, p_vpa text, p_payee_name text, p_price_inr integer,
  p_plan text, p_period_days integer, p_qr_url text
) returns void language plpgsql security definer set search_path = public
as $$
declare v_vpa text := nullif(trim(p_vpa), ''); v_name text := nullif(trim(p_payee_name), ''); v_qr text := nullif(trim(p_qr_url), '');
begin
  if not public.is_admin() then raise exception 'ReFound+ settings require admin access'; end if;
  if p_enabled and ((v_vpa is null and v_qr is null) or v_name is null or p_price_inr is null or p_price_inr < 1) then
    raise exception 'Add a UPI ID or QR image, payee name, and positive INR price before enabling public support';
  end if;
  if p_plan not in ('ONE_TIME','SUBSCRIPTION') then raise exception 'Choose a valid payment plan'; end if;
  if p_period_days not between 1 and 366 then raise exception 'Membership duration must be between 1 and 366 days'; end if;
  update public.app_settings set
    refound_plus_public_enabled = p_enabled,
    refound_plus_upi_vpa = v_vpa,
    refound_plus_payee_name = v_name,
    refound_plus_price_inr = p_price_inr,
    refound_plus_plan = p_plan,
    refound_plus_period_days = p_period_days,
    refound_plus_qr_url = v_qr,
    updated_at = now(), updated_by = auth.uid()
  where singleton;
  perform public.log_audit_event('ADMIN_ACTION', auth.uid(), 'app_settings', null,
    jsonb_build_object('action','UPDATE_REFOUND_PLUS_SETTINGS','enabled',p_enabled,'plan',p_plan,'price_inr',p_price_inr));
end;
$$;

create or replace function public.create_refound_plus_payment_request()
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_settings public.app_settings%rowtype; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;
  if not public.campus_access_allowed(auth.uid()) then raise exception 'Verify your campus account before requesting ReFound+'; end if;
  if public.is_admin() then raise exception 'ReFound+ is already included for admin accounts'; end if;
  select * into v_settings from public.app_settings where singleton;
  if not coalesce(v_settings.refound_plus_public_enabled,false)
    or (v_settings.refound_plus_upi_vpa is null and v_settings.refound_plus_qr_url is null) or v_settings.refound_plus_price_inr is null then
    raise exception 'ReFound+ payments are not open yet';
  end if;
  if exists(select 1 from public.refound_plus_entitlements e where e.user_id=auth.uid() and e.status='ACTIVE' and (e.ends_at is null or e.ends_at>now())) then
    raise exception 'Your ReFound+ membership is already active';
  end if;
  if exists(select 1 from public.refound_plus_payment_requests r where r.user_id=auth.uid() and r.status in ('AWAITING_PAYMENT','PENDING_REVIEW')) then
    raise exception 'You already have a payment request in progress';
  end if;
  insert into public.refound_plus_payment_requests(user_id,amount_inr,plan,period_days,upi_vpa,payee_name,qr_url)
  values(auth.uid(),v_settings.refound_plus_price_inr,v_settings.refound_plus_plan,v_settings.refound_plus_period_days,
    v_settings.refound_plus_upi_vpa,v_settings.refound_plus_payee_name,v_settings.refound_plus_qr_url)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.submit_refound_plus_utr(p_request_id uuid, p_utr text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_utr text := upper(regexp_replace(trim(coalesce(p_utr,'')), '\s+', '', 'g'));
begin
  if not public.campus_access_allowed(auth.uid()) then raise exception 'Verify your campus account before submitting payment details'; end if;
  if char_length(v_utr) not between 8 and 40 or v_utr !~ '^[A-Z0-9/-]+$' then raise exception 'Enter a valid UPI transaction reference (8–40 letters or numbers)'; end if;
  update public.refound_plus_payment_requests set utr=v_utr,status='PENDING_REVIEW',updated_at=now()
  where id=p_request_id and user_id=auth.uid() and status='AWAITING_PAYMENT';
  if not found then raise exception 'This request cannot accept a transaction reference'; end if;
end;
$$;

create or replace function public.cancel_refound_plus_payment_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.refound_plus_payment_requests set status='CANCELLED',updated_at=now()
  where id=p_request_id and user_id=auth.uid() and status='AWAITING_PAYMENT';
  if not found then raise exception 'This payment request cannot be cancelled'; end if;
end;
$$;

create or replace function public.get_my_refound_plus_payment_requests()
returns setof public.refound_plus_payment_requests language sql stable security definer set search_path = public
as $$ select * from public.refound_plus_payment_requests where user_id=auth.uid() order by created_at desc limit 20; $$;

create or replace function public.admin_list_refound_plus_payment_requests()
returns table(id uuid,user_id uuid,user_name text,user_email text,amount_inr integer,plan text,period_days integer,status text,utr text,admin_note text,created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query select r.id,r.user_id,p.full_name,u.email::text,r.amount_inr,r.plan,r.period_days,r.status,r.utr,r.admin_note,r.created_at
  from public.refound_plus_payment_requests r join public.profiles p on p.id=r.user_id join auth.users u on u.id=r.user_id
  order by case when r.status='PENDING_REVIEW' then 0 when r.status='AWAITING_PAYMENT' then 1 else 2 end, r.created_at desc;
end;
$$;

create or replace function public.admin_review_refound_plus_payment(p_request_id uuid,p_approve boolean,p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare r public.refound_plus_payment_requests%rowtype; v_start timestamptz := now(); v_end timestamptz;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into r from public.refound_plus_payment_requests where id=p_request_id for update;
  if not found or r.status <> 'PENDING_REVIEW' then raise exception 'This payment request is not awaiting review'; end if;
  update public.refound_plus_payment_requests set status=case when p_approve then 'APPROVED' else 'REJECTED' end,
    admin_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_request_id;
  if p_approve then
    if r.plan='SUBSCRIPTION' then v_end := v_start + make_interval(days => r.period_days); end if;
    insert into public.refound_plus_entitlements(user_id,status,source,starts_at,ends_at)
      values(r.user_id,'ACTIVE','PAYMENT',v_start,v_end)
      on conflict(user_id) do update set status='ACTIVE',source='PAYMENT',starts_at=v_start,ends_at=v_end,updated_at=now();
  end if;
  perform public.log_audit_event('ADMIN_ACTION',auth.uid(),'refound_plus_payment_request',r.id,
    jsonb_build_object('action',case when p_approve then 'APPROVE_REFOUND_PLUS_PAYMENT' else 'REJECT_REFOUND_PLUS_PAYMENT' end,'user_id',r.user_id,'amount_inr',r.amount_inr,'utr',r.utr));
end;
$$;

create or replace function public.protect_profile_accent()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.profile_accent is distinct from old.profile_accent then
    if public.is_admin(auth.uid()) then raise exception 'Admin accounts keep their custom appearance'; end if;
    if not exists(select 1 from public.refound_plus_entitlements e where e.user_id=auth.uid() and e.status='ACTIVE'
      and (e.starts_at is null or e.starts_at<=now()) and (e.ends_at is null or e.ends_at>now())) then
      raise exception 'Profile accents are a ReFound+ perk';
    end if;
  end if;
  return new;
end;
$$;
create trigger protect_profile_accent_before_update before update of profile_accent on public.profiles
  for each row execute function public.protect_profile_accent();

-- Free accounts keep five saved searches; Plus/admin accounts can save more. Existing rows remain intact.
create or replace function public.enforce_saved_search_plus_limit()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if public.is_admin(new.user_id) or exists(select 1 from public.refound_plus_entitlements e where e.user_id=new.user_id and e.status='ACTIVE'
    and (e.starts_at is null or e.starts_at<=now()) and (e.ends_at is null or e.ends_at>now())) then return new; end if;
  if (select count(*) from public.saved_searches s where s.user_id=new.user_id) >= 5 then
    raise exception 'Free accounts can save up to five searches. ReFound+ includes unlimited saved searches.';
  end if;
  return new;
end;
$$;
create trigger enforce_saved_search_plus_limit_before_insert before insert on public.saved_searches
  for each row execute function public.enforce_saved_search_plus_limit();

revoke all on function public.get_refound_plus_settings() from public, anon;
revoke all on function public.admin_update_refound_plus_settings(boolean,text,text,integer,text,integer,text) from public, anon, authenticated;
revoke all on function public.create_refound_plus_payment_request() from public, anon;
revoke all on function public.submit_refound_plus_utr(uuid,text) from public, anon;
revoke all on function public.cancel_refound_plus_payment_request(uuid) from public, anon;
revoke all on function public.get_my_refound_plus_payment_requests() from public, anon;
revoke all on function public.admin_list_refound_plus_payment_requests() from public, anon, authenticated;
revoke all on function public.admin_review_refound_plus_payment(uuid,boolean,text) from public, anon, authenticated;
revoke all on function public.protect_profile_accent() from public, anon, authenticated;
revoke all on function public.enforce_saved_search_plus_limit() from public, anon, authenticated;
grant execute on function public.get_refound_plus_settings() to authenticated;
grant execute on function public.admin_update_refound_plus_settings(boolean,text,text,integer,text,integer,text) to authenticated;
grant execute on function public.create_refound_plus_payment_request() to authenticated;
grant execute on function public.submit_refound_plus_utr(uuid,text) to authenticated;
grant execute on function public.cancel_refound_plus_payment_request(uuid) to authenticated;
grant execute on function public.get_my_refound_plus_payment_requests() to authenticated;
grant execute on function public.admin_list_refound_plus_payment_requests() to authenticated;
grant execute on function public.admin_review_refound_plus_payment(uuid,boolean,text) to authenticated;
