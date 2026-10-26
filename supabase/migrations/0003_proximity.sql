-- ReFound — Sprint 3: Proximity Assist
-- Run this after 0001_init.sql and 0002_matching.sql, in the Supabase SQL editor.
-- Adds opt-in proximity preferences to profiles and a minimal alert log used
-- only for 24h cooldown deduplication — no continuous location history is
-- ever stored; only a rounded distance and a timestamp per alert sent.

-- ============================================================================
-- Proximity Assist preferences (opt-in, per user)
-- ============================================================================
alter table public.profiles
  add column proximity_assist_enabled boolean not null default false,
  add column proximity_radius_meters integer not null default 100
    check (proximity_radius_meters in (50, 100, 250, 500));

comment on column public.profiles.proximity_assist_enabled is
  'Explicit opt-in. Off by default. The app must never request geolocation permission unless this was just turned on by the user.';

-- ============================================================================
-- Proximity alert log — dedup/cooldown only, never raw location history.
-- ============================================================================
create table public.proximity_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  notification_type text not null default 'PROXIMITY_ALERT',
  distance_meters double precision not null,
  sent_at timestamptz not null default now()
);

comment on table public.proximity_alerts is
  'Records that a proximity alert was sent, for 24h cooldown deduplication. Stores a rounded distance only — never the user''s coordinates.';

create index proximity_alerts_user_item_idx on public.proximity_alerts (user_id, item_id, sent_at desc);

alter table public.proximity_alerts enable row level security;

-- A user may only see and create their own alert log entries.
create policy "proximity_alerts_select_own"
  on public.proximity_alerts for select
  to authenticated
  using (user_id = auth.uid());

create policy "proximity_alerts_insert_own"
  on public.proximity_alerts for insert
  to authenticated
  with check (user_id = auth.uid());

-- ============================================================================
-- record_proximity_alert — atomically checks the 24h cooldown and inserts a
-- log row in a single statement (no separate select-then-insert round trip,
-- so there's no race window). Returns the new row's id if an alert should be
-- shown, or null if the user was already alerted about this item recently.
-- ============================================================================
create or replace function public.record_proximity_alert(
  p_item_id uuid,
  p_distance_meters double precision
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.proximity_alerts (user_id, item_id, distance_meters)
  select auth.uid(), p_item_id, round(p_distance_meters::numeric)
  where not exists (
    select 1 from public.proximity_alerts
    where user_id = auth.uid()
      and item_id = p_item_id
      and sent_at > now() - interval '24 hours'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.record_proximity_alert(uuid, double precision) to authenticated;
