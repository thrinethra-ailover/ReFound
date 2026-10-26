-- Runtime campus email verification settings. The allowed domain list is
-- editable by admins; the initial value comes from the project owner's campus.
create table public.app_settings (
  singleton boolean primary key default true check (singleton),
  campus_verification_enabled boolean not null default false,
  campus_email_domains text[] not null default array['student.nitw.ac.in']::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.app_settings(singleton) values (true);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from public, anon, authenticated;

create or replace function public.is_campus_email_allowed(p_email text)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(exists (
    select 1 from public.app_settings s, unnest(s.campus_email_domains) d(domain)
    where lower(split_part(trim(coalesce(p_email, '')), '@', 2)) = d.domain
       or lower(split_part(trim(coalesce(p_email, '')), '@', 2)) like '%.' || d.domain
  ), false);
$$;

create or replace function public.get_campus_verification_settings()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('enabled', s.campus_verification_enabled, 'domains', to_jsonb(s.campus_email_domains))
  from public.app_settings s where s.singleton;
$$;

create or replace function public.campus_access_allowed(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when not coalesce((select campus_verification_enabled from public.app_settings where singleton), false) then true
    when p_user_id is null then false
    when public.is_admin(p_user_id) then true
    else exists (
      select 1 from public.profiles p join auth.users u on u.id = p.id
      where p.id = p_user_id and p.campus_email_verified
        and u.email_confirmed_at is not null
        and lower(p.campus_email) = lower(u.email)
        and public.is_campus_email_allowed(u.email)
    )
  end;
$$;

create or replace function public.my_campus_verification_status()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_settings public.app_settings%rowtype; v_user_email text;
begin
  select * into v_settings from public.app_settings where singleton;
  select u.email into v_user_email from auth.users u where u.id = auth.uid();
  return jsonb_build_object(
    'enabled', coalesce(v_settings.campus_verification_enabled, false),
    'domains', to_jsonb(coalesce(v_settings.campus_email_domains, array[]::text[])),
    'verified', coalesce(public.campus_access_allowed(auth.uid()), false),
    'email', v_user_email
  );
end;
$$;

create or replace function public.admin_update_campus_verification(p_enabled boolean, p_domains text[])
returns void language plpgsql security definer set search_path = public
as $$
declare v_domains text[];
begin
  if not public.is_admin() then raise exception 'Campus verification settings require admin access'; end if;
  select coalesce(array_agg(domain order by domain), array[]::text[]) into v_domains
  from (
    select distinct lower(trim(value)) as domain from unnest(coalesce(p_domains, array[]::text[])) value
    where trim(value) <> ''
  ) normalized;
  if p_enabled and cardinality(v_domains) = 0 then raise exception 'Add at least one campus email domain first'; end if;
  if exists (select 1 from unnest(v_domains) d(domain) where domain !~ '^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$') then
    raise exception 'Enter domains like student.example.edu without an @ sign';
  end if;
  update public.app_settings set campus_verification_enabled = p_enabled,
    campus_email_domains = v_domains, updated_at = now(), updated_by = auth.uid() where singleton;
  update public.profiles p set campus_email = lower(u.email),
    campus_email_verified = (u.email_confirmed_at is not null and public.is_campus_email_allowed(u.email)),
    updated_at = now() from auth.users u where u.id = p.id;
  perform public.log_audit_event('ADMIN_ACTION', auth.uid(), 'app_settings', null,
    jsonb_build_object('action', 'UPDATE_CAMPUS_VERIFICATION', 'enabled', p_enabled, 'domains', v_domains));
end;
$$;

-- Protect the verification marker from self-service profile writes.
create or replace function public.protect_campus_profile_fields()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin','supabase_auth_admin') and auth.uid() is not null then
    if tg_op = 'INSERT' then
      if new.campus_email is not null or new.campus_email_verified then
        raise exception 'Campus verification fields are managed by ReFound authentication';
      end if;
    elsif new.campus_email is distinct from old.campus_email
       or new.campus_email_verified is distinct from old.campus_email_verified then
      raise exception 'Campus verification fields are managed by ReFound authentication';
    end if;
  end if;
  return new;
end;
$$;
create trigger protect_campus_profile_fields_trigger before insert or update on public.profiles
  for each row execute function public.protect_campus_profile_fields();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_enabled boolean;
begin
  select campus_verification_enabled into v_enabled from public.app_settings where singleton;
  if coalesce(v_enabled, false) and not public.is_campus_email_allowed(new.email) then
    raise exception 'Use an email address issued by the campus to create a ReFound account';
  end if;
  insert into public.profiles(id, full_name, campus_email, campus_email_verified)
  values (new.id, new.raw_user_meta_data->>'full_name', lower(new.email),
    new.email_confirmed_at is not null and public.is_campus_email_allowed(new.email))
  on conflict (id) do update set campus_email = excluded.campus_email,
    campus_email_verified = excluded.campus_email_verified;
  return new;
end;
$$;

create or replace function public.sync_campus_email_from_auth()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_enabled boolean;
begin
  select campus_verification_enabled into v_enabled from public.app_settings where singleton;
  if coalesce(v_enabled, false) and not public.is_campus_email_allowed(new.email) then
    raise exception 'Use an allowed campus email while campus verification is enabled';
  end if;
  update public.profiles set campus_email = lower(new.email),
    campus_email_verified = (new.email_confirmed_at is not null and public.is_campus_email_allowed(new.email)),
    updated_at = now() where id = new.id;
  return new;
end;
$$;
create trigger sync_campus_email_from_auth_trigger after update of email, email_confirmed_at on auth.users
  for each row when (old.email is distinct from new.email or old.email_confirmed_at is distinct from new.email_confirmed_at)
  execute function public.sync_campus_email_from_auth();

-- Restrictive RLS gates close access even where older permissive policies exist.
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'items','item_images','item_verification_attributes','item_matches','notifications',
    'match_verification_attempts','proximity_alerts','match_status_history','match_messages',
    'push_subscriptions','admin_users','audit_log','suspicious_activity_flags'
  ] loop
    execute format('create policy campus_verification_gate on public.%I as restrictive for all to authenticated using (public.campus_access_allowed()) with check (public.campus_access_allowed())', v_table);
  end loop;
end;
$$;
create policy campus_verification_storage_gate on storage.objects as restrictive for all to authenticated
  using (bucket_id not in ('item-images','profile-photos') or public.campus_access_allowed())
  with check (bucket_id not in ('item-images','profile-photos') or public.campus_access_allowed());

-- SECURITY DEFINER write RPCs bypass RLS, so guard their table writes too.
create or replace function public.guard_campus_protected_write()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.campus_access_allowed() then
    raise exception 'Verify a campus email before using ReFound';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'items','item_images','item_verification_attributes','item_matches','notifications',
    'match_verification_attempts','proximity_alerts','match_status_history','match_messages','push_subscriptions'
  ] loop
    execute format('create trigger campus_verification_write_gate before insert or update or delete on public.%I for each row execute function public.guard_campus_protected_write()', v_table);
  end loop;
end;
$$;

revoke all on function public.is_campus_email_allowed(text) from public, anon, authenticated;
revoke all on function public.campus_access_allowed(uuid) from public, anon;
revoke all on function public.my_campus_verification_status() from public, anon;
revoke all on function public.admin_update_campus_verification(boolean, text[]) from public, anon;
revoke all on function public.protect_campus_profile_fields() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_campus_email_from_auth() from public, anon, authenticated;
revoke all on function public.guard_campus_protected_write() from public, anon, authenticated;
grant execute on function public.get_campus_verification_settings() to anon, authenticated;
grant execute on function public.campus_access_allowed(uuid) to authenticated;
grant execute on function public.my_campus_verification_status() to authenticated;
grant execute on function public.admin_update_campus_verification(boolean, text[]) to authenticated;
