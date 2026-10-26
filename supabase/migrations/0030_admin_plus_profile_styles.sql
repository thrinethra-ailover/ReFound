-- Paid Admins may customize the visual treatment of their role-based profile
-- banner and badge. Their badge, title, and role identity remain Admin-branded.
create or replace function public.protect_refound_plus_profile_rewards()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_creator boolean := public.is_creator(auth.uid());
  v_active boolean := exists(
    select 1 from public.refound_plus_entitlements e where e.user_id=auth.uid()
      and e.status='ACTIVE' and (e.starts_at is null or e.starts_at<=now())
      and (e.ends_at is null or e.ends_at>now())
  );
begin
  if new.profile_banner is distinct from old.profile_banner
      or new.supporter_badge_style is distinct from old.supporter_badge_style then
    if v_creator then raise exception 'Creator profile styling is managed by the Creator console'; end if;
    if not v_active then raise exception 'An active ReFound+ membership is required to customize profile styles'; end if;
  end if;
  if new.supporter_recognition_enabled and v_creator then
    raise exception 'Creator accounts are not listed on the public wall';
  end if;
  if new.supporter_recognition_enabled and not v_active then
    raise exception 'An active ReFound+ membership is required for recognition';
  end if;
  if new.supporter_recognition_enabled and nullif(trim(new.supporter_display_name),'') is null then
    raise exception 'Choose a display name before joining the public wall';
  end if;
  if new.supporter_display_name is distinct from old.supporter_display_name
      and new.supporter_display_name is not null and (v_creator or not v_active) then
    raise exception 'An active ReFound+ membership is required to set a public recognition name';
  end if;
  return new;
end; $$;

revoke all on function public.protect_refound_plus_profile_rewards() from public, anon, authenticated;
