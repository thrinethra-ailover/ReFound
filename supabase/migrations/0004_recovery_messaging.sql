-- ReFound — Sprint 4: QR recovery, notifications, messaging, handoff
-- Run this after 0001_init.sql, 0002_matching.sql, and 0003_proximity.sql.
-- Adds: HANDOFF_SCHEDULED status + handoff details, an auto-logged status
-- history table (Feature 3's timeline), match-scoped messaging with
-- Realtime, a public QR recovery token + safe lookup RPC, and push
-- subscription storage for Firebase Cloud Messaging.

-- ============================================================================
-- item_matches — extend status enum with HANDOFF_SCHEDULED, add handoff details
-- ============================================================================
alter table public.item_matches drop constraint item_matches_status_check;
alter table public.item_matches add constraint item_matches_status_check check (
  status in (
    'POTENTIAL_MATCH',
    'VERIFICATION_PENDING',
    'VERIFIED',
    'REJECTED',
    'RECOVERY_IN_PROGRESS',
    'HANDOFF_SCHEDULED',
    'RECOVERED'
  )
);

alter table public.item_matches
  add column handoff_scheduled_at timestamptz,
  add column handoff_location text;

-- ============================================================================
-- match_status_history — Feature 2/3: every transition is stored with a
-- timestamp, populated automatically by a trigger so no RPC needs to
-- remember to log it (and existing Sprint 2 RPCs don't need to change).
-- ============================================================================
create table public.match_status_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.item_matches (id) on delete cascade,
  status text not null,
  changed_at timestamptz not null default now()
);

create index match_status_history_match_id_idx on public.match_status_history (match_id, changed_at);

create or replace function public.log_match_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.match_status_history (match_id, status) values (new.id, new.status);
  end if;
  return new;
end;
$$;

create trigger log_match_status_change_trigger
  after insert or update of status on public.item_matches
  for each row execute function public.log_match_status_change();

alter table public.match_status_history enable row level security;

create policy "match_status_history_select_participants"
  on public.match_status_history for select
  to authenticated
  using (
    exists (
      select 1
      from public.item_matches m
      where m.id = match_status_history.match_id
        and (
          exists (select 1 from public.items i where i.id = m.lost_item_id and i.reporter_id = auth.uid())
          or exists (select 1 from public.items i where i.id = m.found_item_id and i.reporter_id = auth.uid())
        )
    )
  );
-- No insert/update/delete policy: history rows are only ever written by the
-- trigger above (SECURITY DEFINER), never directly by a client.

-- ============================================================================
-- schedule_handoff — RECOVERY_IN_PROGRESS -> HANDOFF_SCHEDULED, either
-- participant may propose a time/place. advance_recovery (redefined below)
-- then moves HANDOFF_SCHEDULED -> RECOVERED once complete.
-- ============================================================================
create or replace function public.schedule_handoff(
  p_match_id uuid,
  p_scheduled_at timestamptz,
  p_location text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
begin
  select m.*, l.reporter_id as lost_reporter, f.reporter_id as found_reporter
  into v_match
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = p_match_id;

  if v_match.id is null then
    raise exception 'schedule_handoff: match not found';
  end if;
  if auth.uid() is distinct from v_match.lost_reporter and auth.uid() is distinct from v_match.found_reporter then
    raise exception 'schedule_handoff: only a participant may schedule a handoff';
  end if;
  if v_match.status <> 'RECOVERY_IN_PROGRESS' then
    raise exception 'schedule_handoff: match must be in RECOVERY_IN_PROGRESS to schedule a handoff';
  end if;
  if length(trim(coalesce(p_location, ''))) = 0 then
    raise exception 'schedule_handoff: a location is required';
  end if;

  update public.item_matches
  set status = 'HANDOFF_SCHEDULED',
      handoff_scheduled_at = p_scheduled_at,
      handoff_location = trim(p_location),
      updated_at = now()
  where id = p_match_id;

  insert into public.notifications (user_id, type, title, body, related_match_id)
  values (
    case when auth.uid() = v_match.lost_reporter then v_match.found_reporter else v_match.lost_reporter end,
    'HANDOFF_SCHEDULED',
    'Handoff scheduled',
    'The other party proposed a time and place to hand off the item.',
    p_match_id
  );
end;
$$;

grant execute on function public.schedule_handoff(uuid, timestamptz, text) to authenticated;

-- ============================================================================
-- advance_recovery — redefined to support the fuller state machine:
-- VERIFIED -> RECOVERY_IN_PROGRESS -> HANDOFF_SCHEDULED -> RECOVERED,
-- while still allowing RECOVERY_IN_PROGRESS -> RECOVERED directly for pairs
-- who coordinate a handoff without using the scheduling step.
-- ============================================================================
create or replace function public.advance_recovery(p_match_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
  v_allowed boolean := false;
begin
  if p_status not in ('RECOVERY_IN_PROGRESS', 'HANDOFF_SCHEDULED', 'RECOVERED') then
    raise exception 'advance_recovery: invalid target status';
  end if;

  select m.*, l.reporter_id as lost_reporter, f.reporter_id as found_reporter
  into v_match
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = p_match_id;

  if v_match.id is null then
    raise exception 'advance_recovery: match not found';
  end if;
  if auth.uid() is distinct from v_match.lost_reporter and auth.uid() is distinct from v_match.found_reporter then
    raise exception 'advance_recovery: only a participant may update recovery status';
  end if;

  v_allowed := (v_match.status = 'VERIFIED' and p_status = 'RECOVERY_IN_PROGRESS')
    or (v_match.status = 'RECOVERY_IN_PROGRESS' and p_status = 'RECOVERED')
    or (v_match.status = 'HANDOFF_SCHEDULED' and p_status = 'RECOVERED');

  if not v_allowed then
    raise exception 'advance_recovery: invalid status transition';
  end if;

  update public.item_matches set status = p_status, updated_at = now() where id = p_match_id;

  if p_status = 'RECOVERED' then
    update public.items set status = 'RESOLVED', updated_at = now()
    where id in (v_match.lost_item_id, v_match.found_item_id) and status = 'ACTIVE';
  end if;

  insert into public.notifications (user_id, type, title, body, related_match_id)
  values (
    case when auth.uid() = v_match.lost_reporter then v_match.found_reporter else v_match.lost_reporter end,
    'RECOVERY_UPDATE',
    case when p_status = 'RECOVERED' then 'Item marked recovered' else 'Recovery in progress' end,
    case
      when p_status = 'RECOVERED' then 'The handoff was marked complete. Thanks for using ReFound!'
      else 'The other party started the recovery handoff process.'
    end,
    p_match_id
  );
end;
$$;

-- ============================================================================
-- Messaging — Feature 4/5: messages are always scoped to a match, never
-- arbitrary global messaging. Plain RLS (no RPC needed) since both parties
-- act on their own behalf and no cross-user privilege escalation occurs.
-- ============================================================================
create table public.match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.item_matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index match_messages_match_id_idx on public.match_messages (match_id, created_at);

alter table public.match_messages enable row level security;

create policy "match_messages_select_participants"
  on public.match_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.item_matches m
      join public.items l on l.id = m.lost_item_id
      join public.items f on f.id = m.found_item_id
      where m.id = match_messages.match_id
        and (l.reporter_id = auth.uid() or f.reporter_id = auth.uid())
    )
  );

-- Messaging only opens once the finder has engaged (status has moved past
-- POTENTIAL_MATCH) and the match hasn't been dismissed.
create policy "match_messages_insert_participants"
  on public.match_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.item_matches m
      join public.items l on l.id = m.lost_item_id
      join public.items f on f.id = m.found_item_id
      where m.id = match_messages.match_id
        and m.status not in ('POTENTIAL_MATCH', 'REJECTED')
        and (l.reporter_id = auth.uid() or f.reporter_id = auth.uid())
    )
  );

-- Every new message notifies the other participant (Feature 6: "New Recovery Message").
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_lost_reporter uuid;
  v_found_reporter uuid;
  v_recipient uuid;
begin
  select l.reporter_id, f.reporter_id into v_lost_reporter, v_found_reporter
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = new.match_id;

  v_recipient := case when new.sender_id = v_lost_reporter then v_found_reporter else v_lost_reporter end;

  insert into public.notifications (user_id, type, title, body, related_match_id)
  values (v_recipient, 'NEW_MESSAGE', 'New message', 'You have a new message about a recovery.', new.match_id);

  return new;
end;
$$;

create trigger notify_new_message_trigger
  after insert on public.match_messages
  for each row execute function public.notify_new_message();

alter publication supabase_realtime add table public.match_messages;

-- ============================================================================
-- QR recovery — Feature 1/8: a separate opaque token (not the item's real
-- primary key) is what gets encoded in the QR code, and only a narrow,
-- SECURITY DEFINER lookup is exposed publicly — never the raw items table.
-- ============================================================================
alter table public.items add column recovery_token uuid not null default gen_random_uuid();
create unique index items_recovery_token_idx on public.items (recovery_token);

comment on column public.items.recovery_token is
  'Opaque public token encoded in a FOUND item''s QR code. Deliberately distinct '
  'from the item''s primary key and resolved only via get_recovery_info(), which '
  'returns a narrow, safe field set — never reporter identity or hidden attributes.';

create or replace function public.get_recovery_info(p_token uuid)
returns table (
  item_id uuid,
  category text,
  title text,
  location_name text,
  report_type text,
  created_at timestamptz
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
    select i.id, i.category, i.title, i.location_name, i.report_type, i.created_at
    from public.items i
    where i.recovery_token = p_token
      and i.report_type = 'FOUND'
      and i.status = 'ACTIVE';
end;
$$;

-- Callable by anonymous visitors scanning a QR code, and by logged-in users.
grant execute on function public.get_recovery_info(uuid) to anon, authenticated;

-- ============================================================================
-- Notifications — extend type enum for the new event types, and allow a
-- user to insert their own PROXIMITY_ALERT echo (everything else remains
-- writable only via SECURITY DEFINER functions, unchanged from Sprint 2).
-- ============================================================================
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'MATCH_FOUND',
    'VERIFICATION_REQUESTED',
    'VERIFICATION_UPDATE',
    'MATCH_VERIFIED',
    'MATCH_REJECTED',
    'RECOVERY_UPDATE',
    'HANDOFF_SCHEDULED',
    'NEW_MESSAGE',
    'PROXIMITY_ALERT'
  )
);

create policy "notifications_insert_own_proximity_alert"
  on public.notifications for insert
  to authenticated
  with check (user_id = auth.uid() and type = 'PROXIMITY_ALERT');

-- ============================================================================
-- Push subscriptions (Firebase Cloud Messaging) — Feature 6
-- ============================================================================
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fcm_token text not null unique,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- profiles — per-channel notification preferences (Feature 6/7)
-- ============================================================================
alter table public.profiles
  add column push_notifications_enabled boolean not null default false,
  add column email_notifications_enabled boolean not null default true;
