-- More profile personalization, privacy-safe supporter recognition, and private impact stats.
alter table public.profiles
  add column profile_banner text not null default 'AURORA'
    check (profile_banner in ('AURORA','CIRCUIT','NIGHT_SKY','CRYSTAL','EMBER')),
  add column supporter_badge_style text not null default 'CLASSIC'
    check (supporter_badge_style in ('CLASSIC','PRISM','EMBER','OCEAN','EMERALD')),
  add column supporter_recognition_enabled boolean not null default false,
  add column supporter_display_name text
    check (supporter_display_name is null or char_length(trim(supporter_display_name)) between 1 and 40);

alter table public.refound_plus_entitlements add column first_started_at timestamptz;
update public.refound_plus_entitlements
set first_started_at = coalesce(starts_at, created_at)
where first_started_at is null;

create or replace function public.preserve_refound_plus_first_start()
returns trigger language plpgsql set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.first_started_at := coalesce(old.first_started_at, new.first_started_at, new.starts_at, new.created_at, now());
  else
    new.first_started_at := coalesce(new.first_started_at, new.starts_at, new.created_at, now());
  end if;
  return new;
end;
$$;
create trigger preserve_refound_plus_first_start_before_write
  before insert or update on public.refound_plus_entitlements
  for each row execute function public.preserve_refound_plus_first_start();

create or replace function public.protect_refound_plus_profile_rewards()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_admin boolean := public.is_admin(auth.uid());
  v_active boolean := exists (
    select 1 from public.refound_plus_entitlements e
    where e.user_id = auth.uid() and e.status = 'ACTIVE'
      and (e.starts_at is null or e.starts_at <= now())
      and (e.ends_at is null or e.ends_at > now())
  );
begin
  if (new.profile_banner is distinct from old.profile_banner
      or new.supporter_badge_style is distinct from old.supporter_badge_style)
      and not v_admin and not v_active then
    raise exception 'These profile styles are a ReFound+ perk';
  end if;

  if new.supporter_recognition_enabled and v_admin then
    raise exception 'Admin accounts are not listed as supporters';
  end if;
  if new.supporter_recognition_enabled and not v_active then
    raise exception 'Active ReFound+ membership is required for supporter recognition';
  end if;
  if new.supporter_recognition_enabled and nullif(trim(new.supporter_display_name), '') is null then
    raise exception 'Choose a display name before joining the supporter wall';
  end if;
  if new.supporter_display_name is distinct from old.supporter_display_name
      and new.supporter_display_name is not null and not v_admin and not v_active then
    raise exception 'Active ReFound+ membership is required to set a supporter display name';
  end if;
  return new;
end;
$$;
create trigger protect_refound_plus_profile_rewards_before_update
  before update of profile_banner, supporter_badge_style, supporter_recognition_enabled, supporter_display_name
  on public.profiles for each row execute function public.protect_refound_plus_profile_rewards();

create or replace function public.get_my_refound_plus_impact()
returns table (reports_shared bigint, lost_reports bigint, found_reports bigint, recoveries_confirmed bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view your private impact recap'; end if;
  if not public.is_admin(auth.uid()) and not exists (
    select 1 from public.refound_plus_entitlements e
    where e.user_id = auth.uid() and e.status = 'ACTIVE'
      and (e.starts_at is null or e.starts_at <= now())
      and (e.ends_at is null or e.ends_at > now())
  ) then
    raise exception 'The private impact recap is a ReFound+ perk';
  end if;
  return query
    select count(i.id)::bigint,
      count(i.id) filter (where i.report_type = 'LOST')::bigint,
      count(i.id) filter (where i.report_type = 'FOUND')::bigint,
      (select count(distinct m.id)::bigint
       from public.item_matches m
       join public.items lost on lost.id = m.lost_item_id
       join public.items found on found.id = m.found_item_id
       where m.status = 'RECOVERED'
         and (lost.reporter_id = auth.uid() or found.reporter_id = auth.uid()))
    from public.items i
    where i.reporter_id = auth.uid();
end;
$$;

create or replace function public.get_refound_plus_supporter_wall()
returns table (display_name text, badge_level text, badge_style text)
language sql stable security definer set search_path = public
as $$
  select left(trim(p.supporter_display_name), 40),
    case
      when now() - coalesce(e.first_started_at, e.starts_at, e.created_at) >= interval '365 days' then 'Legacy'
      when now() - coalesce(e.first_started_at, e.starts_at, e.created_at) >= interval '90 days' then 'Guardian'
      when now() - coalesce(e.first_started_at, e.starts_at, e.created_at) >= interval '30 days' then 'Beacon'
      else 'New supporter'
    end,
    p.supporter_badge_style
  from public.profiles p
  join public.refound_plus_entitlements e on e.user_id = p.id
  where p.supporter_recognition_enabled
    and nullif(trim(p.supporter_display_name), '') is not null
    and e.status = 'ACTIVE'
    and (e.starts_at is null or e.starts_at <= now())
    and (e.ends_at is null or e.ends_at > now())
  order by e.first_started_at asc nulls last, p.supporter_display_name asc
  limit 100;
$$;

revoke all on function public.preserve_refound_plus_first_start() from public, anon, authenticated;
revoke all on function public.protect_refound_plus_profile_rewards() from public, anon, authenticated;
revoke all on function public.get_my_refound_plus_impact() from public, anon;
revoke all on function public.get_refound_plus_supporter_wall() from public;
grant execute on function public.get_my_refound_plus_impact() to authenticated;
grant execute on function public.get_refound_plus_supporter_wall() to anon, authenticated;
