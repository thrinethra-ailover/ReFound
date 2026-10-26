-- ReFound — Sprint 5: Admin dashboard, analytics, security, audit log
-- Run this after 0001-0004. Adds a database-enforced admin role (never a
-- self-editable profiles column), an automatic audit log populated by
-- triggers (no existing RPC needed to change), rule-based suspicious
-- activity scoring, and safe aggregate-only analytics functions.

-- ============================================================================
-- Admin role — Feature 1
-- Deliberately a SEPARATE table, never a column on `profiles`. profiles has
-- a self-service "update own row" policy (0001_init.sql); an `is_admin`
-- column there would let a user grant themselves admin. Only the project
-- owner (via SQL editor / service role) can write to admin_users — there is
-- no insert/update/delete policy for the `authenticated` role at all.
-- ============================================================================
create table public.admin_users (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  granted_at timestamptz not null default now(),
  notes text
);

alter table public.admin_users enable row level security;
-- No policies for `authenticated` beyond the admin-only one added below —
-- default-deny means normal users cannot read or write this table at all.

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admin_users a where a.user_id = p_user_id);
$$;

grant execute on function public.is_admin(uuid) to authenticated;

create policy "admin_users_select_admin"
  on public.admin_users for select
  to authenticated
  using (public.is_admin());

-- To grant the first admin, run as the project owner in the SQL editor:
--   insert into public.admin_users (user_id) values ('<the user''s auth.users id>');

-- ============================================================================
-- Admin read access to existing tables — additive SELECT-only policies.
-- Never grants direct UPDATE/DELETE via RLS; all admin writes go through the
-- audited RPCs below, and hidden verification attribute VALUES remain
-- inaccessible to admins entirely (only pass/fail booleans were ever stored
-- for those, per Sprint 2).
-- ============================================================================
create policy "items_select_admin"
  on public.items for select
  to authenticated
  using (public.is_admin());

create policy "item_matches_select_admin"
  on public.item_matches for select
  to authenticated
  using (public.is_admin());

create policy "match_verification_attempts_select_admin"
  on public.match_verification_attempts for select
  to authenticated
  using (public.is_admin());

create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- ============================================================================
-- Audit log — Feature 7. Populated entirely by triggers/RPCs (SECURITY
-- DEFINER), never by direct client inserts, so no existing Sprint 2-4 RPC
-- needs to change and the log cannot be spoofed from the client.
-- ============================================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in (
      'REPORT_CREATED',
      'REPORT_UPDATED',
      'MATCH_GENERATED',
      'VERIFICATION_ATTEMPTED',
      'VERIFICATION_PASSED',
      'VERIFICATION_REJECTED',
      'MESSAGE_SENT',
      'ITEM_RECOVERED',
      'ADMIN_ACTION'
    )
  ),
  actor_id uuid references public.profiles (id) on delete set null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_actor_id_idx on public.audit_log (actor_id);
create index audit_log_event_type_idx on public.audit_log (event_type);

alter table public.audit_log enable row level security;

create policy "audit_log_select_admin"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());
-- No insert policy for `authenticated` — every row is written by a
-- SECURITY DEFINER trigger function below, which bypasses RLS as its owner.

create or replace function public.log_audit_event(
  p_event_type text,
  p_actor_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.audit_log (event_type, actor_id, target_type, target_id, metadata)
  values (p_event_type, p_actor_id, p_target_type, p_target_id, p_metadata);
end;
$$;

-- ---- Automatic audit triggers ----

create or replace function public.audit_report_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.log_audit_event(
    'REPORT_CREATED', new.reporter_id, 'item', new.id,
    jsonb_build_object('report_type', new.report_type, 'category', new.category)
  );
  return new;
end;
$$;

create trigger audit_report_created_trigger
  after insert on public.items
  for each row execute function public.audit_report_created();

create or replace function public.audit_report_updated()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_audit_event(
      'REPORT_UPDATED', new.reporter_id, 'item', new.id,
      jsonb_build_object('from_status', old.status, 'to_status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger audit_report_updated_trigger
  after update of status on public.items
  for each row execute function public.audit_report_updated();

create or replace function public.audit_match_generated()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.log_audit_event(
    'MATCH_GENERATED', null, 'match', new.id,
    jsonb_build_object('score', new.score)
  );
  return new;
end;
$$;

create trigger audit_match_generated_trigger
  after insert on public.item_matches
  for each row execute function public.audit_match_generated();

create or replace function public.audit_verification_attempted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.log_audit_event(
    'VERIFICATION_ATTEMPTED', new.attempted_by, 'match', new.match_id,
    jsonb_build_object('is_correct', new.is_correct)
  );
  return new;
end;
$$;

create trigger audit_verification_attempted_trigger
  after insert on public.match_verification_attempts
  for each row execute function public.audit_verification_attempted();

create or replace function public.audit_match_status_events()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.status = 'VERIFICATION_PENDING' and new.status = 'VERIFIED' then
    perform public.log_audit_event('VERIFICATION_PASSED', null, 'match', new.id, '{}'::jsonb);
  elsif old.status = 'VERIFICATION_PENDING' and new.status = 'REJECTED' then
    perform public.log_audit_event('VERIFICATION_REJECTED', null, 'match', new.id, '{}'::jsonb);
  elsif new.status = 'RECOVERED' and old.status is distinct from 'RECOVERED' then
    perform public.log_audit_event('ITEM_RECOVERED', null, 'match', new.id, '{}'::jsonb);
  end if;
  return new;
end;
$$;

create trigger audit_match_status_events_trigger
  after update of status on public.item_matches
  for each row execute function public.audit_match_status_events();

-- Never logs message content — only that a message was sent, and by whom.
create or replace function public.audit_message_sent()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.log_audit_event('MESSAGE_SENT', new.sender_id, 'match', new.match_id, '{}'::jsonb);
  return new;
end;
$$;

create trigger audit_message_sent_trigger
  after insert on public.match_messages
  for each row execute function public.audit_message_sent();

-- ============================================================================
-- Suspicious activity — Feature 5. Deterministic, rule-based, recomputed on
-- demand by an admin (or a scheduled job in production — see README). Never
-- auto-bans; only ever produces a risk score + "admin review required" flag.
-- ============================================================================
create table public.suspicious_activity_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rule_hits jsonb not null default '[]'::jsonb,
  risk_score integer not null default 0,
  risk_level text not null default 'LOW' check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  status text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW', 'REVIEWED', 'DISMISSED')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index suspicious_activity_flags_status_idx on public.suspicious_activity_flags (status);
create index suspicious_activity_flags_risk_idx on public.suspicious_activity_flags (risk_score desc);

alter table public.suspicious_activity_flags enable row level security;

create policy "suspicious_activity_flags_select_admin"
  on public.suspicious_activity_flags for select
  to authenticated
  using (public.is_admin());
-- No direct insert/update policy — written only by refresh_suspicious_activity()
-- and admin_review_flag() below.

create trigger set_suspicious_activity_flags_updated_at
  before update on public.suspicious_activity_flags
  for each row execute function public.set_updated_at();

-- Recomputes every user's risk score from current data. Admin-only.
create or replace function public.refresh_suspicious_activity()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_flagged_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'refresh_suspicious_activity: admin access required';
  end if;

  with high_found_volume as (
    select reporter_id as user_id, count(*) as hit_count
    from public.items
    where report_type = 'FOUND' and created_at > now() - interval '7 days'
    group by reporter_id
    having count(*) >= 5
  ),
  failed_verifications as (
    select attempted_by as user_id, count(*) as hit_count
    from public.match_verification_attempts
    where is_correct = false
    group by attempted_by
    having count(*) >= 5
  ),
  rejected_claims as (
    select f.reporter_id as user_id, count(*) as hit_count
    from public.item_matches m
    join public.items f on f.id = m.found_item_id
    where m.status = 'REJECTED'
    group by f.reporter_id
    having count(*) >= 3
  ),
  duplicate_reports as (
    select reporter_id as user_id, count(*) as hit_count
    from (
      select reporter_id, title, category, location_name,
             date_trunc('day', created_at) as report_day, count(*) as dup_count
      from public.items
      group by reporter_id, title, category, location_name, date_trunc('day', created_at)
      having count(*) >= 2
    ) dup
    group by reporter_id
  ),
  scattered_locations as (
    select reporter_id as user_id, count(distinct location_name) as hit_count
    from public.items
    where created_at > now() - interval '24 hours' and location_name is not null
    group by reporter_id
    having count(distinct location_name) >= 4
  ),
  scored as (
    select
      coalesce(h.user_id, fv.user_id, rc.user_id, dr.user_id, sl.user_id) as user_id,
      jsonb_strip_nulls(jsonb_build_array(
        case when h.user_id is not null then jsonb_build_object('rule', 'HIGH_FOUND_VOLUME', 'count', h.hit_count) end,
        case when fv.user_id is not null then jsonb_build_object('rule', 'REPEATED_FAILED_VERIFICATION', 'count', fv.hit_count) end,
        case when rc.user_id is not null then jsonb_build_object('rule', 'REPEATED_REJECTED_CLAIMS', 'count', rc.hit_count) end,
        case when dr.user_id is not null then jsonb_build_object('rule', 'DUPLICATE_REPORTS', 'count', dr.hit_count) end,
        case when sl.user_id is not null then jsonb_build_object('rule', 'SCATTERED_LOCATIONS', 'count', sl.hit_count) end
      )) as rule_hits,
      (case when h.user_id is not null then 30 else 0 end) +
      (case when fv.user_id is not null then 25 else 0 end) +
      (case when rc.user_id is not null then 25 else 0 end) +
      (case when dr.user_id is not null then 20 else 0 end) +
      (case when sl.user_id is not null then 20 else 0 end) as risk_score
    from high_found_volume h
    full outer join failed_verifications fv on fv.user_id = h.user_id
    full outer join rejected_claims rc on rc.user_id = coalesce(h.user_id, fv.user_id)
    full outer join duplicate_reports dr on dr.user_id = coalesce(h.user_id, fv.user_id, rc.user_id)
    full outer join scattered_locations sl on sl.user_id = coalesce(h.user_id, fv.user_id, rc.user_id, dr.user_id)
  )
  insert into public.suspicious_activity_flags (user_id, rule_hits, risk_score, risk_level, status)
  select
    user_id,
    rule_hits,
    risk_score,
    case when risk_score >= 50 then 'HIGH' when risk_score >= 25 then 'MEDIUM' else 'LOW' end,
    'PENDING_REVIEW'
  from scored
  where user_id is not null and risk_score > 0
  on conflict (user_id) do update
    set rule_hits = excluded.rule_hits,
        risk_score = excluded.risk_score,
        risk_level = excluded.risk_level,
        status = case
          when suspicious_activity_flags.risk_score < excluded.risk_score then 'PENDING_REVIEW'
          else suspicious_activity_flags.status
        end,
        updated_at = now();

  get diagnostics v_flagged_count = row_count;
  return v_flagged_count;
end;
$$;

grant execute on function public.refresh_suspicious_activity() to authenticated;

create or replace function public.admin_review_flag(p_flag_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_target_user uuid;
begin
  if not public.is_admin() then
    raise exception 'admin_review_flag: admin access required';
  end if;
  if p_status not in ('REVIEWED', 'DISMISSED', 'PENDING_REVIEW') then
    raise exception 'admin_review_flag: invalid status';
  end if;

  select user_id into v_target_user from public.suspicious_activity_flags where id = p_flag_id;
  if v_target_user is null then
    raise exception 'admin_review_flag: flag not found';
  end if;

  update public.suspicious_activity_flags
  set status = p_status, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = p_flag_id;

  perform public.log_audit_event(
    'ADMIN_ACTION', auth.uid(), 'suspicious_activity_flag', p_flag_id,
    jsonb_build_object('action', 'review_flag', 'new_status', p_status, 'notes', p_notes, 'flagged_user', v_target_user)
  );
end;
$$;

grant execute on function public.admin_review_flag(uuid, text, text) to authenticated;

-- ============================================================================
-- Admin report actions — Feature 6. Every write is an audited RPC; there is
-- no blanket admin UPDATE policy on `items`, so an admin cannot silently
-- edit report content — only these two narrow, logged transitions.
-- ============================================================================
create or replace function public.admin_deactivate_item(p_item_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_deactivate_item: admin access required';
  end if;

  update public.items set status = 'CANCELLED', updated_at = now() where id = p_item_id;

  perform public.log_audit_event(
    'ADMIN_ACTION', auth.uid(), 'item', p_item_id,
    jsonb_build_object('action', 'deactivate', 'reason', p_reason)
  );
end;
$$;

create or replace function public.admin_resolve_item(p_item_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_resolve_item: admin access required';
  end if;

  update public.items set status = 'RESOLVED', updated_at = now() where id = p_item_id;

  perform public.log_audit_event(
    'ADMIN_ACTION', auth.uid(), 'item', p_item_id,
    jsonb_build_object('action', 'resolve')
  );
end;
$$;

grant execute on function public.admin_deactivate_item(uuid, text) to authenticated;
grant execute on function public.admin_resolve_item(uuid) to authenticated;

-- ============================================================================
-- Analytics — Features 2/3/4. Every function is admin-gated and returns only
-- aggregate counts/averages — never a reporter id, never raw coordinates,
-- never hidden attribute values.
-- ============================================================================
create or replace function public.admin_dashboard_stats()
returns table (
  active_lost_count bigint,
  active_found_count bigint,
  potential_matches_count bigint,
  verified_matches_count bigint,
  recovered_count bigint,
  avg_recovery_hours numeric,
  reports_this_week bigint,
  recovery_rate_pct numeric
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_dashboard_stats: admin access required';
  end if;

  return query
    select
      (select count(*) from public.items where report_type = 'LOST' and status = 'ACTIVE'),
      (select count(*) from public.items where report_type = 'FOUND' and status = 'ACTIVE'),
      (select count(*) from public.item_matches where status = 'POTENTIAL_MATCH'),
      (select count(*) from public.item_matches where status in ('VERIFIED', 'RECOVERY_IN_PROGRESS', 'HANDOFF_SCHEDULED', 'RECOVERED')),
      (select count(*) from public.item_matches where status = 'RECOVERED'),
      (select round(avg(extract(epoch from (m.updated_at - m.created_at)) / 3600)::numeric, 1)
         from public.item_matches m where m.status = 'RECOVERED'),
      (select count(*) from public.items where created_at > now() - interval '7 days'),
      (select case when count(*) filter (where status in ('VERIFIED','REJECTED','RECOVERY_IN_PROGRESS','HANDOFF_SCHEDULED','RECOVERED')) = 0 then 0
              else round(
                100.0 * count(*) filter (where status = 'RECOVERED')
                / count(*) filter (where status in ('VERIFIED','REJECTED','RECOVERY_IN_PROGRESS','HANDOFF_SCHEDULED','RECOVERED')),
                1
              ) end
       from public.item_matches);
end;
$$;

create or replace function public.admin_location_heatmap()
returns table (location_name text, report_type text, report_count bigint)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_location_heatmap: admin access required';
  end if;

  return query
    select i.location_name, i.report_type, count(*) as report_count
    from public.items i
    where i.location_name is not null
    group by i.location_name, i.report_type
    order by report_count desc
    limit 25;
end;
$$;

create or replace function public.admin_recovery_hotspots()
returns table (location_name text, recovered_count bigint)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_recovery_hotspots: admin access required';
  end if;

  return query
    select l.location_name, count(*) as recovered_count
    from public.item_matches m
    join public.items l on l.id = m.lost_item_id
    where m.status = 'RECOVERED' and l.location_name is not null
    group by l.location_name
    order by recovered_count desc
    limit 15;
end;
$$;

create or replace function public.admin_category_frequency()
returns table (category text, report_type text, report_count bigint)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_category_frequency: admin access required';
  end if;

  return query
    select i.category, i.report_type, count(*) as report_count
    from public.items i
    group by i.category, i.report_type
    order by report_count desc;
end;
$$;

create or replace function public.admin_time_distribution()
returns table (hour_of_day integer, report_count bigint)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_time_distribution: admin access required';
  end if;

  return query
    select extract(hour from created_at)::integer as hour_of_day, count(*) as report_count
    from public.items
    group by hour_of_day
    order by hour_of_day;
end;
$$;

create or replace function public.admin_match_analytics()
returns table (
  avg_score numeric,
  strong_matches bigint,
  possible_matches bigint,
  rejected_matches bigint,
  verified_matches bigint,
  recovery_conversion_pct numeric
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_match_analytics: admin access required';
  end if;

  return query
    select
      round(avg(score)::numeric, 1),
      count(*) filter (where score >= 80),
      count(*) filter (where score >= 60 and score < 80),
      count(*) filter (where status = 'REJECTED'),
      count(*) filter (where status in ('VERIFIED','RECOVERY_IN_PROGRESS','HANDOFF_SCHEDULED','RECOVERED')),
      case when count(*) filter (where status in ('VERIFIED','RECOVERY_IN_PROGRESS','HANDOFF_SCHEDULED','RECOVERED')) = 0 then 0
        else round(
          100.0 * count(*) filter (where status = 'RECOVERED')
          / count(*) filter (where status in ('VERIFIED','RECOVERY_IN_PROGRESS','HANDOFF_SCHEDULED','RECOVERED')),
          1
        ) end
    from public.item_matches;
end;
$$;

grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_location_heatmap() to authenticated;
grant execute on function public.admin_recovery_hotspots() to authenticated;
grant execute on function public.admin_category_frequency() to authenticated;
grant execute on function public.admin_time_distribution() to authenticated;
grant execute on function public.admin_match_analytics() to authenticated;

-- ============================================================================
-- Performance — Feature 9: a few additional indexes justified by the new
-- admin queries above (existing Sprint 1-4 indexes already cover the app's
-- normal read paths).
-- ============================================================================
create index if not exists items_location_name_idx on public.items (location_name);
create index if not exists items_report_type_status_idx on public.items (report_type, status);
create index if not exists item_matches_status_created_idx on public.item_matches (status, created_at);
