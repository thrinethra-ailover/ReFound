-- Stale report reminders, renewal, and notification channel preferences.

alter table public.items
  add column last_confirmed_active_at timestamptz not null default now(),
  add column stale_reminded_at timestamptz;
update public.items set last_confirmed_active_at = created_at;

alter table public.profiles
  add column notification_preferences jsonb not null default '{"matches":true,"verification":true,"messages":true,"recovery":true,"savedSearches":true,"proximity":true}'::jsonb;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'MATCH_FOUND','VERIFICATION_REQUESTED','VERIFICATION_UPDATE','MATCH_VERIFIED','MATCH_REJECTED',
  'RECOVERY_UPDATE','HANDOFF_SCHEDULED','NEW_MESSAGE','PROXIMITY_ALERT','SAVED_SEARCH_MATCH',
  'REPORT_STALE_REMINDER','REPORT_ARCHIVED_STALE'
));

create or replace function public.refresh_my_stale_reports()
returns integer language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
  v_item record;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  -- Give the owner seven days from their reminder to renew a report.
  for v_item in
    update public.items
      set status = 'CANCELLED', updated_at = now()
      where reporter_id = v_user_id and status = 'ACTIVE'
        and stale_reminded_at <= now() - interval '7 days'
      returning id, title
  loop
    insert into public.notifications(user_id,type,title,body,related_item_id)
      values (v_user_id,'REPORT_ARCHIVED_STALE','An inactive report was archived',
        left('“' || v_item.title || '” was archived after 7 days without confirmation. You can reopen it from your dashboard.',240),v_item.id);
    v_count := v_count + 1;
  end loop;

  -- A report receives a reminder once it has been active for 30 days.
  for v_item in
    update public.items
      set stale_reminded_at = now()
      where reporter_id = v_user_id and status = 'ACTIVE' and stale_reminded_at is null
        and coalesce(last_confirmed_active_at, created_at) <= now() - interval '30 days'
      returning id, title
  loop
    insert into public.notifications(user_id,type,title,body,related_item_id)
      values (v_user_id,'REPORT_STALE_REMINDER','Is this report still active?',
        left('“' || v_item.title || '” has been active for 30 days. Confirm it within 7 days to keep it visible for matching.',240),v_item.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.refresh_my_stale_reports() from public, anon;
grant execute on function public.refresh_my_stale_reports() to authenticated;

create or replace function public.confirm_own_item_active(p_item_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.items set last_confirmed_active_at = now(), stale_reminded_at = null, updated_at = now()
    where id = p_item_id and reporter_id = auth.uid() and status = 'ACTIVE';
  if not found then raise exception 'Active report not found'; end if;
end;
$$;
revoke all on function public.confirm_own_item_active(uuid) from public, anon;
grant execute on function public.confirm_own_item_active(uuid) to authenticated;

