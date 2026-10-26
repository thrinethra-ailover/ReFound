-- Paid Admins retain their fixed Admin identity, but may opt in to public
-- recognition using that identity. Creator accounts remain excluded.
create or replace function public.protect_refound_plus_profile_rewards()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_staff boolean := public.is_admin(auth.uid());
  v_creator boolean := public.is_creator(auth.uid());
  v_active boolean := exists(
    select 1 from public.refound_plus_entitlements e where e.user_id=auth.uid()
      and e.status='ACTIVE' and (e.starts_at is null or e.starts_at<=now())
      and (e.ends_at is null or e.ends_at>now())
  );
begin
  if new.profile_banner is distinct from old.profile_banner
      or new.supporter_badge_style is distinct from old.supporter_badge_style then
    if v_staff then raise exception 'Creator and Admin insignias are managed by role'; end if;
    if not v_active then raise exception 'These profile styles are a ReFound+ perk'; end if;
  end if;
  if new.supporter_recognition_enabled and v_creator then
    raise exception 'Creator accounts are not listed on the public wall';
  end if;
  if new.supporter_recognition_enabled and not v_active then
    raise exception 'Active ReFound+ membership is required for recognition';
  end if;
  if new.supporter_recognition_enabled and nullif(trim(new.supporter_display_name),'') is null then
    raise exception 'Choose a display name before joining the public wall';
  end if;
  if new.supporter_display_name is distinct from old.supporter_display_name
      and new.supporter_display_name is not null and (v_creator or not v_active) then
    raise exception 'Active ReFound+ membership is required to set a public recognition name';
  end if;
  return new;
end; $$;

create or replace function public.get_refound_plus_supporter_wall()
returns table (display_name text, badge_level text, badge_style text)
language sql stable security definer set search_path = public as $$
  select left(trim(p.supporter_display_name),40),
    case when public.is_admin(p.id) then 'ReFound Admin'
      when now()-coalesce(e.first_started_at,e.starts_at,e.created_at)>=interval '365 days' then 'Legacy'
      when now()-coalesce(e.first_started_at,e.starts_at,e.created_at)>=interval '90 days' then 'Guardian'
      when now()-coalesce(e.first_started_at,e.starts_at,e.created_at)>=interval '30 days' then 'Beacon'
      else 'New supporter'
    end,
    p.supporter_badge_style
  from public.profiles p
  join public.refound_plus_entitlements e on e.user_id=p.id
  where p.supporter_recognition_enabled
    and nullif(trim(p.supporter_display_name),'') is not null
    and not public.is_creator(p.id)
    and e.status='ACTIVE'
    and (e.starts_at is null or e.starts_at<=now())
    and (e.ends_at is null or e.ends_at>now())
  order by e.first_started_at asc nulls last,p.supporter_display_name asc
  limit 100;
$$;

revoke all on function public.protect_refound_plus_profile_rewards() from public, anon, authenticated;
revoke all on function public.get_refound_plus_supporter_wall() from public;
grant execute on function public.get_refound_plus_supporter_wall() to anon, authenticated;
