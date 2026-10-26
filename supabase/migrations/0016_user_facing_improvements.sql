-- Search alerts, user report flags, and owner report editing support.

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  keyword text check (keyword is null or char_length(trim(keyword)) <= 120),
  report_type text not null default 'ALL' check (report_type in ('ALL','LOST','FOUND')),
  category text,
  location text check (location is null or char_length(trim(location)) <= 120),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index saved_searches_enabled_idx on public.saved_searches(enabled, report_type, category) where enabled;
create index saved_searches_owner_idx on public.saved_searches(user_id, created_at desc);
alter table public.saved_searches enable row level security;
create policy saved_searches_owner_all on public.saved_searches for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_searches_campus_gate on public.saved_searches as restrictive for all to authenticated
  using (public.campus_access_allowed()) with check (public.campus_access_allowed());

create table public.report_abuse_flags (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('SPAM','INAPPROPRIATE','MISLEADING','DUPLICATE','OTHER')),
  details text check (details is null or char_length(trim(details)) <= 1000),
  status text not null default 'PENDING' check (status in ('PENDING','REVIEWED','DISMISSED')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_abuse_flags_one_per_user unique(item_id, reporter_id)
);
create index report_abuse_flags_status_idx on public.report_abuse_flags(status, created_at desc);
alter table public.report_abuse_flags enable row level security;
create policy report_abuse_flags_insert_own on public.report_abuse_flags for insert to authenticated
  with check (reporter_id = auth.uid() and exists (
    select 1 from public.items i where i.id = item_id and i.status = 'ACTIVE' and i.reporter_id <> auth.uid()
  ));
create policy report_abuse_flags_admin_select on public.report_abuse_flags for select to authenticated
  using (public.is_admin());
create policy report_abuse_flags_campus_gate on public.report_abuse_flags as restrictive for all to authenticated
  using (public.campus_access_allowed()) with check (public.campus_access_allowed());

create or replace function public.admin_review_report_flag(p_flag_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('REVIEWED','DISMISSED') then raise exception 'Invalid flag status'; end if;
  update public.report_abuse_flags set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_flag_id and status = 'PENDING';
  if not found then raise exception 'Flag not found or already reviewed'; end if;
  perform public.log_audit_event('ADMIN_ACTION', auth.uid(), 'report_abuse_flags', p_flag_id,
    jsonb_build_object('action','REVIEW_REPORT_FLAG','status',p_status));
end;
$$;
revoke all on function public.admin_review_report_flag(uuid,text) from public, anon;
grant execute on function public.admin_review_report_flag(uuid,text) to authenticated;

alter table public.notifications add column related_item_id uuid references public.items(id) on delete set null;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'MATCH_FOUND','VERIFICATION_REQUESTED','VERIFICATION_UPDATE','MATCH_VERIFIED','MATCH_REJECTED',
  'RECOVERY_UPDATE','HANDOFF_SCHEDULED','NEW_MESSAGE','PROXIMITY_ALERT','SAVED_SEARCH_MATCH'
));
create unique index notifications_saved_search_dedup_idx
  on public.notifications(user_id, related_item_id) where type = 'SAVED_SEARCH_MATCH' and related_item_id is not null;

create or replace function public.notify_saved_search_matches()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_search record;
begin
  if tg_op = 'UPDATE' then
    if old.status is not distinct from new.status then return new; end if;
  end if;
  if new.status <> 'ACTIVE' then return new; end if;
  for v_search in
    select s.* from public.saved_searches s
    where s.enabled and s.user_id <> new.reporter_id
      and public.campus_access_allowed(s.user_id)
      and (s.report_type = 'ALL' or s.report_type = new.report_type)
      and (s.category is null or s.category = new.category)
      and (nullif(trim(s.keyword),'') is null or position(lower(trim(s.keyword)) in lower(concat_ws(' ',new.title,new.description,new.category,new.location_name))) > 0)
      and (nullif(trim(s.location),'') is null or position(lower(trim(s.location)) in lower(coalesce(new.location_name,''))) > 0)
  loop
    if not exists (select 1 from public.notifications n where n.user_id = v_search.user_id
      and n.type = 'SAVED_SEARCH_MATCH' and n.related_item_id = new.id) then
      insert into public.notifications(user_id,type,title,body,related_item_id)
        values (v_search.user_id,'SAVED_SEARCH_MATCH','A report matches your saved search',
          left(new.title || ' · ' || new.category || ' · ' || coalesce(new.location_name,'Campus'), 240),new.id)
        on conflict do nothing;
    end if;
  end loop;
  return new;
end;
$$;
create trigger notify_saved_search_matches_trigger after insert or update of status on public.items
  for each row execute function public.notify_saved_search_matches();

