-- Split the permanent Creator role from the delegated ReFound Admin role.
-- Existing admin grants are promoted to Creator once, then removed from the
-- delegated-admin list. No owner email addresses are stored in this migration.
create table if not exists public.creator_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.creator_users enable row level security;
revoke all on public.creator_users from public, anon, authenticated;

insert into public.creator_users(user_id)
select user_id from public.admin_users on conflict do nothing;
delete from public.admin_users where user_id in (select user_id from public.creator_users);

create or replace function public.is_creator(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.creator_users c where c.user_id = p_user_id); $$;
grant execute on function public.is_creator(uuid) to authenticated;

-- is_admin means staff access (Creator or delegated Admin), preserving the
-- existing admin RPC and RLS paths. Creator-only capabilities use is_creator.
create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.admin_users a where a.user_id = p_user_id)
      or public.is_creator(p_user_id);
$$;
grant execute on function public.is_admin(uuid) to authenticated;

drop policy if exists refound_plus_entitlements_select_admin on public.refound_plus_entitlements;
create policy refound_plus_entitlements_select_creator
  on public.refound_plus_entitlements for select to authenticated
  using (public.is_creator());

create or replace function public.creator_list_admins()
returns table(user_id uuid, email text, full_name text, granted_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_creator() then raise exception 'Creator access required'; end if;
  return query select a.user_id, u.email::text, p.full_name, a.granted_at
  from public.admin_users a join auth.users u on u.id = a.user_id
  left join public.profiles p on p.id = a.user_id order by a.granted_at;
end;
$$;

create or replace function public.creator_grant_admin(p_email text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_user_id uuid;
begin
  if not public.is_creator() then raise exception 'Creator access required'; end if;
  select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user_id is null then raise exception 'No registered account has that email'; end if;
  if public.is_creator(v_user_id) then raise exception 'Creator accounts cannot be changed from Admin access'; end if;
  insert into public.admin_users(user_id, notes) values(v_user_id, 'Granted by Creator')
    on conflict(user_id) do nothing;
end;
$$;

create or replace function public.creator_revoke_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_creator() then raise exception 'Creator access required'; end if;
  if public.is_creator(p_user_id) then raise exception 'Creator access cannot be revoked here'; end if;
  delete from public.admin_users where user_id = p_user_id;
  if not found then raise exception 'That account does not have delegated Admin access'; end if;
end;
$$;
revoke all on function public.creator_list_admins() from public, anon;
revoke all on function public.creator_grant_admin(text) from public, anon;
revoke all on function public.creator_revoke_admin(uuid) from public, anon;
grant execute on function public.creator_list_admins() to authenticated;
grant execute on function public.creator_grant_admin(text) to authenticated;
grant execute on function public.creator_revoke_admin(uuid) to authenticated;

-- Only the Creator may inspect private verification attributes.
alter function public.admin_get_active_report_details(uuid) rename to creator_get_active_report_details_internal;
revoke all on function public.creator_get_active_report_details_internal(uuid) from public, anon, authenticated;
create function public.admin_get_active_report_details(p_item_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_creator() then raise exception 'Creator access required to view private report details'; end if;
  return public.creator_get_active_report_details_internal(p_item_id);
end;
$$;
revoke all on function public.admin_get_active_report_details(uuid) from public, anon;
grant execute on function public.admin_get_active_report_details(uuid) to authenticated;

-- ReFound+ configuration and payment review remain Creator-only. Keep the
-- prior implementations private and expose guarded wrappers to the app.
alter function public.admin_update_refound_plus_settings(boolean,text,text,integer,text,integer,text) rename to creator_update_plus_settings_internal;
revoke all on function public.creator_update_plus_settings_internal(boolean,text,text,integer,text,integer,text) from public, anon, authenticated;
create function public.admin_update_refound_plus_settings(
  p_enabled boolean, p_vpa text, p_payee_name text, p_price_inr integer,
  p_plan text, p_period_days integer, p_qr_url text
) returns void language plpgsql security definer set search_path = public
as $$ begin
  if not public.is_creator() then raise exception 'Creator access required'; end if;
  perform public.creator_update_plus_settings_internal(p_enabled,p_vpa,p_payee_name,p_price_inr,p_plan,p_period_days,p_qr_url);
end; $$;
revoke all on function public.admin_update_refound_plus_settings(boolean,text,text,integer,text,integer,text) from public, anon;
grant execute on function public.admin_update_refound_plus_settings(boolean,text,text,integer,text,integer,text) to authenticated;

alter function public.admin_list_refound_plus_payment_requests() rename to creator_list_plus_requests_internal;
revoke all on function public.creator_list_plus_requests_internal() from public, anon, authenticated;
create function public.admin_list_refound_plus_payment_requests()
returns table(id uuid,user_id uuid,user_name text,user_email text,amount_inr integer,plan text,period_days integer,status text,utr text,admin_note text,created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_creator() then raise exception 'Creator access required'; end if;
  return query select * from public.creator_list_plus_requests_internal();
end; $$;
revoke all on function public.admin_list_refound_plus_payment_requests() from public, anon;
grant execute on function public.admin_list_refound_plus_payment_requests() to authenticated;

alter function public.admin_review_refound_plus_payment(uuid,boolean,text) rename to creator_review_plus_payment_internal;
revoke all on function public.creator_review_plus_payment_internal(uuid,boolean,text) from public, anon, authenticated;
create function public.admin_review_refound_plus_payment(p_request_id uuid,p_approve boolean,p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_creator() then raise exception 'Creator access required'; end if;
  perform public.creator_review_plus_payment_internal(p_request_id,p_approve,p_note);
end; $$;
revoke all on function public.admin_review_refound_plus_payment(uuid,boolean,text) from public, anon;
grant execute on function public.admin_review_refound_plus_payment(uuid,boolean,text) to authenticated;

-- Any account may pay or claim the one-time trial, including delegated Admins.
create or replace function public.create_refound_plus_payment_request()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_settings public.app_settings%rowtype; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;
  if public.is_creator() then raise exception 'ReFound+ is included for the Creator'; end if;
  if not public.campus_access_allowed(auth.uid()) then raise exception 'Verify your campus account before requesting ReFound+'; end if;
  select * into v_settings from public.app_settings where singleton;
  if not coalesce(v_settings.refound_plus_public_enabled,false)
    or (v_settings.refound_plus_upi_vpa is null and v_settings.refound_plus_qr_url is null) or v_settings.refound_plus_price_inr is null then
    raise exception 'ReFound+ payments are not open yet'; end if;
  if exists(select 1 from public.refound_plus_entitlements e where e.user_id=auth.uid() and e.status='ACTIVE' and (e.ends_at is null or e.ends_at>now())) then raise exception 'Your ReFound+ membership is already active'; end if;
  if exists(select 1 from public.refound_plus_payment_requests r where r.user_id=auth.uid() and r.status in ('AWAITING_PAYMENT','PENDING_REVIEW')) then raise exception 'You already have a payment request in progress'; end if;
  insert into public.refound_plus_payment_requests(user_id,amount_inr,plan,period_days,upi_vpa,payee_name,qr_url)
  values(auth.uid(),v_settings.refound_plus_price_inr,v_settings.refound_plus_plan,v_settings.refound_plus_period_days,v_settings.refound_plus_upi_vpa,v_settings.refound_plus_payee_name,v_settings.refound_plus_qr_url) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.get_my_refound_plus_trial_status()
returns table (eligible boolean, claimed_at timestamptz, ends_at timestamptz, reason text)
language plpgsql stable security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_email text; v_claim public.refound_plus_trial_claims%rowtype;
begin
  if v_user_id is null then raise exception 'Sign in to check trial eligibility'; end if;
  if public.is_creator(v_user_id) then return query select false,null::timestamptz,null::timestamptz,'CREATOR_INCLUDED'::text; return; end if;
  select lower(u.email) into v_email from auth.users u where u.id=v_user_id;
  select c.* into v_claim from public.refound_plus_trial_claims c where c.user_id=v_user_id or lower(c.email_at_claim)=v_email limit 1;
  if found then return query select false,v_claim.claimed_at,v_claim.ends_at,'ALREADY_USED'::text; return; end if;
  if not public.campus_access_allowed(v_user_id) then return query select false,null::timestamptz,null::timestamptz,'CAMPUS_VERIFICATION_REQUIRED'::text; return; end if;
  if exists(select 1 from public.refound_plus_entitlements e where e.user_id=v_user_id and e.status='ACTIVE' and (e.starts_at is null or e.starts_at<=now()) and (e.ends_at is null or e.ends_at>now())) then return query select false,null::timestamptz,null::timestamptz,'ACTIVE_MEMBERSHIP'::text; return; end if;
  if exists(select 1 from public.refound_plus_payment_requests r where r.user_id=v_user_id and r.status in ('AWAITING_PAYMENT','PENDING_REVIEW')) then return query select false,null::timestamptz,null::timestamptz,'PENDING_PAYMENT'::text; return; end if;
  return query select true,null::timestamptz,null::timestamptz,'AVAILABLE'::text;
end; $$;
create or replace function public.claim_refound_plus_free_trial()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_user_id uuid:=auth.uid(); v_email text; v_now timestamptz:=now(); v_ends_at timestamptz:=now()+interval '24 hours'; v_rows integer;
begin
  if v_user_id is null then raise exception 'Sign in to start your free trial'; end if;
  if public.is_creator(v_user_id) then raise exception 'ReFound+ is included for the Creator'; end if;
  if not public.campus_access_allowed(v_user_id) then raise exception 'Verify your campus account before starting a trial'; end if;
  select lower(u.email) into v_email from auth.users u where u.id=v_user_id;
  if v_email is null then raise exception 'Could not verify your account email'; end if;
  if exists(select 1 from public.refound_plus_entitlements e where e.user_id=v_user_id and e.status='ACTIVE' and (e.starts_at is null or e.starts_at<=v_now) and (e.ends_at is null or e.ends_at>v_now)) then raise exception 'Your ReFound+ membership is already active'; end if;
  if exists(select 1 from public.refound_plus_payment_requests r where r.user_id=v_user_id and r.status in ('AWAITING_PAYMENT','PENDING_REVIEW')) then raise exception 'Resolve or cancel your pending payment request before starting a trial'; end if;
  insert into public.refound_plus_trial_claims(user_id,email_at_claim,claimed_at,ends_at) values(v_user_id,v_email,v_now,v_ends_at) on conflict do nothing;
  get diagnostics v_rows=row_count;
  if v_rows=0 then raise exception 'This account has already used its ReFound+ free trial'; end if;
  insert into public.refound_plus_entitlements(user_id,status,source,starts_at,ends_at) values(v_user_id,'ACTIVE','TRIAL',v_now,v_ends_at)
  on conflict(user_id) do update set status='ACTIVE',source='TRIAL',starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=now();
  return v_ends_at;
end; $$;

create or replace function public.protect_profile_accent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.profile_accent is distinct from old.profile_accent then
    if public.is_creator(auth.uid()) then raise exception 'Creator appearance is managed in the Creator console'; end if;
    if not exists(select 1 from public.refound_plus_entitlements e where e.user_id=auth.uid() and e.status='ACTIVE' and (e.starts_at is null or e.starts_at<=now()) and (e.ends_at is null or e.ends_at>now())) then raise exception 'Profile accents are a ReFound+ perk'; end if;
  end if;
  return new;
end; $$;
create or replace function public.enforce_saved_search_plus_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  if public.is_creator(new.user_id) or exists(select 1 from public.refound_plus_entitlements e where e.user_id=new.user_id and e.status='ACTIVE' and (e.starts_at is null or e.starts_at<=now()) and (e.ends_at is null or e.ends_at>now())) then return new; end if;
  if (select count(*) from public.saved_searches s where s.user_id=new.user_id)>=5 then raise exception 'Free accounts can save up to five searches. ReFound+ includes unlimited saved searches.'; end if;
  return new;
end; $$;

create or replace function public.protect_refound_plus_profile_rewards()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_staff boolean := public.is_admin(auth.uid());
  v_active boolean := exists(select 1 from public.refound_plus_entitlements e where e.user_id=auth.uid() and e.status='ACTIVE' and (e.starts_at is null or e.starts_at<=now()) and (e.ends_at is null or e.ends_at>now()));
begin
  if (new.profile_banner is distinct from old.profile_banner or new.supporter_badge_style is distinct from old.supporter_badge_style) then
    if v_staff then raise exception 'Creator and Admin insignias are managed by role'; end if;
    if not v_active then raise exception 'These profile styles are a ReFound+ perk'; end if;
  end if;
  if new.supporter_recognition_enabled and v_staff then raise exception 'Staff accounts are not listed as supporters'; end if;
  if new.supporter_recognition_enabled and not v_active then raise exception 'Active ReFound+ membership is required for supporter recognition'; end if;
  if new.supporter_recognition_enabled and nullif(trim(new.supporter_display_name),'') is null then raise exception 'Choose a display name before joining the supporter wall'; end if;
  if new.supporter_display_name is distinct from old.supporter_display_name and new.supporter_display_name is not null and (v_staff or not v_active) then raise exception 'Active ReFound+ membership is required to set a supporter display name'; end if;
  return new;
end; $$;

create or replace function public.get_my_refound_plus_impact()
returns table (reports_shared bigint, lost_reports bigint, found_reports bigint, recoveries_confirmed bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view your private impact recap'; end if;
  if not public.is_creator(auth.uid()) and not exists(
    select 1 from public.refound_plus_entitlements e where e.user_id=auth.uid() and e.status='ACTIVE'
      and (e.starts_at is null or e.starts_at<=now()) and (e.ends_at is null or e.ends_at>now())
  ) then raise exception 'The private impact recap is a ReFound+ perk'; end if;
  return query select count(i.id)::bigint,
    count(i.id) filter(where i.report_type='LOST')::bigint,
    count(i.id) filter(where i.report_type='FOUND')::bigint,
    (select count(distinct m.id)::bigint from public.item_matches m
      join public.items lost on lost.id=m.lost_item_id join public.items found on found.id=m.found_item_id
      where m.status='RECOVERED' and (lost.reporter_id=auth.uid() or found.reporter_id=auth.uid()))
  from public.items i where i.reporter_id=auth.uid();
end; $$;

create or replace function public.get_refound_plus_supporter_wall()
returns table (display_name text, badge_level text, badge_style text)
language sql stable security definer set search_path = public as $$
  select left(trim(p.supporter_display_name),40),
    case
      when now()-coalesce(e.first_started_at,e.starts_at,e.created_at)>=interval '365 days' then 'Legacy'
      when now()-coalesce(e.first_started_at,e.starts_at,e.created_at)>=interval '90 days' then 'Guardian'
      when now()-coalesce(e.first_started_at,e.starts_at,e.created_at)>=interval '30 days' then 'Beacon'
      else 'New supporter'
    end,
    p.supporter_badge_style
  from public.profiles p join public.refound_plus_entitlements e on e.user_id=p.id
  where p.supporter_recognition_enabled and nullif(trim(p.supporter_display_name),'') is not null
    and not public.is_admin(p.id)
    and e.status='ACTIVE' and (e.starts_at is null or e.starts_at<=now()) and (e.ends_at is null or e.ends_at>now())
  order by e.first_started_at asc nulls last,p.supporter_display_name asc limit 100;
$$;

-- A Creator's moderation action must not look like a report owner's action in the audit feed.
create or replace function public.audit_report_updated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_creator(auth.uid()) then return new; end if;
  if new.status is distinct from old.status then
    perform public.log_audit_event('REPORT_UPDATED',new.reporter_id,'item',new.id,
      jsonb_build_object('from_status',old.status,'to_status',new.status));
  end if;
  return new;
end; $$;

-- Omitting Creator-originated activity centrally keeps owner use out of Admin audit.
create or replace function public.log_audit_event(p_event_type text,p_actor_id uuid,p_target_type text,p_target_id uuid,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_creator(coalesce(p_actor_id,auth.uid())) then return; end if;
  insert into public.audit_log(event_type,actor_id,target_type,target_id,metadata) values(p_event_type,p_actor_id,p_target_type,p_target_id,p_metadata);
end; $$;

-- ReFound+ QR assets may only be uploaded or changed by the Creator.
drop policy if exists refound_plus_qr_admin_insert on storage.objects;
drop policy if exists refound_plus_qr_admin_update on storage.objects;
drop policy if exists refound_plus_qr_admin_delete on storage.objects;
create policy refound_plus_qr_creator_insert on storage.objects for insert to authenticated with check(bucket_id='refound-plus-assets' and public.is_creator());
create policy refound_plus_qr_creator_update on storage.objects for update to authenticated using(bucket_id='refound-plus-assets' and public.is_creator()) with check(bucket_id='refound-plus-assets' and public.is_creator());
create policy refound_plus_qr_creator_delete on storage.objects for delete to authenticated using(bucket_id='refound-plus-assets' and public.is_creator());

