-- ReFound — Sprint 2: Smart matching + blind ownership verification
-- Run this after 0001_init.sql, in order, in the Supabase SQL editor.
-- Adds: item_matches, notifications, match_verification_attempts, and a set
-- of SECURITY DEFINER functions that perform every state transition and
-- blind attribute comparison server-side.

-- ============================================================================
-- Tables
-- ============================================================================

-- A potential (or confirmed) pairing between a LOST report and a FOUND
-- report, produced by the deterministic matching engine.
create table public.item_matches (
  id uuid primary key default gen_random_uuid(),
  lost_item_id uuid not null references public.items (id) on delete cascade,
  found_item_id uuid not null references public.items (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  reasons jsonb not null default '[]'::jsonb,
  distance_meters double precision,
  time_difference_minutes double precision,
  status text not null default 'POTENTIAL_MATCH' check (
    status in (
      'POTENTIAL_MATCH',
      'VERIFICATION_PENDING',
      'VERIFIED',
      'REJECTED',
      'RECOVERY_IN_PROGRESS',
      'RECOVERED'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_matches_distinct_items check (lost_item_id <> found_item_id),
  constraint item_matches_unique_pair unique (lost_item_id, found_item_id)
);

comment on table public.item_matches is
  'Deterministic matching engine output. Score/reasons are explainable, never AI-generated.';

-- Internal notification feed (Feature 6). No external push in this sprint.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (
    type in (
      'MATCH_FOUND',
      'VERIFICATION_REQUESTED',
      'VERIFICATION_UPDATE',
      'MATCH_VERIFIED',
      'MATCH_REJECTED',
      'RECOVERY_UPDATE'
    )
  ),
  title text not null,
  body text not null,
  related_match_id uuid references public.item_matches (id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Records of each blind verification attempt. Deliberately stores only
-- whether the guess was correct — never the claimant's raw guess, and never
-- the owner's private value — so no sensitive text accumulates here.
create table public.match_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.item_matches (id) on delete cascade,
  attribute_key text not null,
  is_correct boolean not null,
  attempted_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================
create index item_matches_lost_item_id_idx on public.item_matches (lost_item_id);
create index item_matches_found_item_id_idx on public.item_matches (found_item_id);
create index item_matches_status_idx on public.item_matches (status);
create index item_matches_score_idx on public.item_matches (score desc);

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index notifications_related_match_id_idx on public.notifications (related_match_id);

create index match_verification_attempts_match_id_idx on public.match_verification_attempts (match_id);
create index match_verification_attempts_attempted_by_idx on public.match_verification_attempts (attempted_by);

create trigger set_item_matches_updated_at
  before update on public.item_matches
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Integrity trigger: a "lost" side must actually be a LOST report and a
-- "found" side must actually be a FOUND report, no matter which path wrote
-- the row (defense in depth alongside the RPCs below).
-- ============================================================================
create or replace function public.validate_item_match()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  lost_type text;
  found_type text;
begin
  select report_type into lost_type from public.items where id = new.lost_item_id;
  select report_type into found_type from public.items where id = new.found_item_id;

  if lost_type is distinct from 'LOST' then
    raise exception 'lost_item_id must reference a LOST report';
  end if;
  if found_type is distinct from 'FOUND' then
    raise exception 'found_item_id must reference a FOUND report';
  end if;

  return new;
end;
$$;

create trigger validate_item_match_trigger
  before insert or update on public.item_matches
  for each row execute function public.validate_item_match();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.item_matches enable row level security;
alter table public.notifications enable row level security;
alter table public.match_verification_attempts enable row level security;

-- ---- item_matches ----
-- Visible only to the two people involved (the lost report's reporter and
-- the found report's reporter). No public browsing of matches. All writes
-- go through the SECURITY DEFINER functions below — there are intentionally
-- no insert/update/delete policies here, so direct client writes are denied.
create policy "item_matches_select_participants"
  on public.item_matches for select
  to authenticated
  using (
    exists (select 1 from public.items i where i.id = item_matches.lost_item_id and i.reporter_id = auth.uid())
    or
    exists (select 1 from public.items i where i.id = item_matches.found_item_id and i.reporter_id = auth.uid())
  );

-- ---- notifications ----
-- Users see and manage only their own notifications. Writes happen only via
-- the SECURITY DEFINER functions (which need to notify the *other* party in
-- a match, something a normal insert-own-only policy could never allow).
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- match_verification_attempts ----
-- The finder can see their own attempts; the lost item's owner can see the
-- pass/fail record (never the raw guesses, which are never stored) so they
-- can decide whether to confirm ownership. No direct insert policy — all
-- attempts are recorded via submit_verification_answer().
create policy "match_verification_attempts_select_participants"
  on public.match_verification_attempts for select
  to authenticated
  using (
    attempted_by = auth.uid()
    or exists (
      select 1
      from public.item_matches m
      join public.items i on i.id = m.lost_item_id
      where m.id = match_verification_attempts.match_id
        and i.reporter_id = auth.uid()
    )
  );

-- ============================================================================
-- record_match — called by the client after the deterministic engine scores
-- a candidate pair at >= 60. Idempotent (safe to call repeatedly as scores
-- are refreshed), authorized (only a participant may write), and the single
-- place notifications for a *new* match are created for both parties.
-- ============================================================================
create or replace function public.record_match(
  p_lost_item_id uuid,
  p_found_item_id uuid,
  p_score integer,
  p_reasons jsonb,
  p_distance_meters double precision,
  p_time_difference_minutes double precision
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_lost record;
  v_found record;
  v_match_id uuid;
  v_is_new boolean := false;
  v_previous_status text;
begin
  if p_score < 60 or p_score > 100 then
    raise exception 'record_match: score must be between 60 and 100 to be recorded';
  end if;

  select id, reporter_id, title, status, report_type into v_lost
  from public.items where id = p_lost_item_id;
  select id, reporter_id, title, status, report_type into v_found
  from public.items where id = p_found_item_id;

  if v_lost.id is null or v_found.id is null then
    raise exception 'record_match: one or both items do not exist';
  end if;
  if v_lost.report_type <> 'LOST' or v_found.report_type <> 'FOUND' then
    raise exception 'record_match: item report types do not match lost/found roles';
  end if;
  if v_lost.status <> 'ACTIVE' or v_found.status <> 'ACTIVE' then
    -- Nothing to do for reports that are no longer active.
    return null;
  end if;
  if v_lost.reporter_id = v_found.reporter_id then
    raise exception 'record_match: a user cannot match their own reports';
  end if;
  if auth.uid() is distinct from v_lost.reporter_id and auth.uid() is distinct from v_found.reporter_id then
    raise exception 'record_match: only a participant may record this match';
  end if;

  select status into v_previous_status
  from public.item_matches
  where lost_item_id = p_lost_item_id and found_item_id = p_found_item_id;

  v_is_new := v_previous_status is null;

  insert into public.item_matches (
    lost_item_id, found_item_id, score, reasons, distance_meters, time_difference_minutes
  )
  values (p_lost_item_id, p_found_item_id, p_score, p_reasons, p_distance_meters, p_time_difference_minutes)
  on conflict (lost_item_id, found_item_id) do update
    set score = excluded.score,
        reasons = excluded.reasons,
        distance_meters = excluded.distance_meters,
        time_difference_minutes = excluded.time_difference_minutes,
        updated_at = now()
    where public.item_matches.status = 'POTENTIAL_MATCH'
  returning id into v_match_id;

  -- If the row wasn't touched (conflict existed but status had moved past
  -- POTENTIAL_MATCH), fetch its id so we still return a stable identifier.
  if v_match_id is null then
    select id into v_match_id
    from public.item_matches
    where lost_item_id = p_lost_item_id and found_item_id = p_found_item_id;
  end if;

  if v_is_new then
    insert into public.notifications (user_id, type, title, body, related_match_id)
    values
      (
        v_lost.reporter_id,
        'MATCH_FOUND',
        'Potential match found',
        format('Potential match found for your lost %s.', v_lost.title),
        v_match_id
      ),
      (
        v_found.reporter_id,
        'MATCH_FOUND',
        'Potential match found',
        format('The item you found may match someone''s lost %s.', v_lost.title),
        v_match_id
      );
  end if;

  return v_match_id;
end;
$$;

-- ============================================================================
-- reject_match — either participant can dismiss a POTENTIAL_MATCH or
-- VERIFICATION_PENDING match that isn't actually theirs.
-- ============================================================================
create or replace function public.reject_match(p_match_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
  v_lost_reporter uuid;
  v_found_reporter uuid;
begin
  select m.*, l.reporter_id as lost_reporter, f.reporter_id as found_reporter
  into v_match
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = p_match_id;

  if v_match.id is null then
    raise exception 'reject_match: match not found';
  end if;
  if auth.uid() is distinct from v_match.lost_reporter and auth.uid() is distinct from v_match.found_reporter then
    raise exception 'reject_match: only a participant may reject this match';
  end if;
  if v_match.status not in ('POTENTIAL_MATCH', 'VERIFICATION_PENDING') then
    raise exception 'reject_match: match cannot be rejected from its current status';
  end if;

  update public.item_matches set status = 'REJECTED', updated_at = now() where id = p_match_id;

  insert into public.notifications (user_id, type, title, body, related_match_id)
  values (
    case when auth.uid() = v_match.lost_reporter then v_match.found_reporter else v_match.lost_reporter end,
    'MATCH_REJECTED',
    'Match dismissed',
    'The other party marked a potential match as not a match.',
    p_match_id
  );
end;
$$;

-- ============================================================================
-- request_match_verification — the finder confirms "I found this item.",
-- moving the match into VERIFICATION_PENDING and notifying the owner.
-- ============================================================================
create or replace function public.request_match_verification(p_match_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
begin
  select m.*, l.reporter_id as lost_reporter, f.reporter_id as found_reporter, l.title as lost_title
  into v_match
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = p_match_id;

  if v_match.id is null then
    raise exception 'request_match_verification: match not found';
  end if;
  if auth.uid() is distinct from v_match.found_reporter then
    raise exception 'request_match_verification: only the finder can confirm they found this item';
  end if;
  if v_match.status <> 'POTENTIAL_MATCH' then
    raise exception 'request_match_verification: match is not awaiting confirmation';
  end if;

  update public.item_matches set status = 'VERIFICATION_PENDING', updated_at = now() where id = p_match_id;

  insert into public.notifications (user_id, type, title, body, related_match_id)
  values (
    v_match.lost_reporter,
    'VERIFICATION_REQUESTED',
    'Someone found your item',
    format('A finder confirmed they may have your lost %s. Verify ownership to continue.', v_match.lost_title),
    p_match_id
  );
end;
$$;

-- ============================================================================
-- get_verification_questions — returns only the private attribute *keys*
-- (never values) the owner recorded on the lost report, so the finder can
-- be asked "does it have X?" without ever seeing what the owner wrote.
-- ============================================================================
create or replace function public.get_verification_questions(p_match_id uuid)
returns table (attribute_key text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
begin
  select m.*, f.reporter_id as found_reporter, l.id as lost_item_id
  into v_match
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = p_match_id;

  if v_match.id is null then
    raise exception 'get_verification_questions: match not found';
  end if;
  if auth.uid() is distinct from v_match.found_reporter then
    raise exception 'get_verification_questions: only the finder answers verification questions';
  end if;
  if v_match.status <> 'VERIFICATION_PENDING' then
    raise exception 'get_verification_questions: match is not in verification';
  end if;

  return query
    select a.attribute_key
    from public.item_verification_attributes a
    where a.item_id = v_match.lost_item_id
    order by a.created_at;
end;
$$;

-- ============================================================================
-- submit_verification_answer — the finder's blind guess for one attribute.
-- Compares server-side against the owner's private value and returns only a
-- boolean. The guess itself is never persisted or shown to the owner.
-- ============================================================================
create or replace function public.submit_verification_answer(
  p_match_id uuid,
  p_attribute_key text,
  p_answer text
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
  v_actual_value text;
  v_is_correct boolean;
begin
  select m.*, f.reporter_id as found_reporter, l.id as lost_item_id
  into v_match
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = p_match_id;

  if v_match.id is null then
    raise exception 'submit_verification_answer: match not found';
  end if;
  if auth.uid() is distinct from v_match.found_reporter then
    raise exception 'submit_verification_answer: only the finder submits verification answers';
  end if;
  if v_match.status <> 'VERIFICATION_PENDING' then
    raise exception 'submit_verification_answer: match is not in verification';
  end if;

  select attribute_value into v_actual_value
  from public.item_verification_attributes
  where item_id = v_match.lost_item_id and attribute_key = p_attribute_key;

  v_is_correct := v_actual_value is not null
    and trim(lower(v_actual_value)) = trim(lower(coalesce(p_answer, '')));

  insert into public.match_verification_attempts (match_id, attribute_key, is_correct, attempted_by)
  values (p_match_id, p_attribute_key, coalesce(v_is_correct, false), auth.uid());

  return coalesce(v_is_correct, false);
end;
$$;

-- ============================================================================
-- finalize_verification — the owner's final call: VERIFIED or REJECTED.
-- Only the owner (lost report's reporter) may decide this.
-- ============================================================================
create or replace function public.finalize_verification(p_match_id uuid, p_decision text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
begin
  if p_decision not in ('VERIFIED', 'REJECTED') then
    raise exception 'finalize_verification: decision must be VERIFIED or REJECTED';
  end if;

  select m.*, l.reporter_id as lost_reporter, f.reporter_id as found_reporter
  into v_match
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = p_match_id;

  if v_match.id is null then
    raise exception 'finalize_verification: match not found';
  end if;
  if auth.uid() is distinct from v_match.lost_reporter then
    raise exception 'finalize_verification: only the reported owner can verify ownership';
  end if;
  if v_match.status <> 'VERIFICATION_PENDING' then
    raise exception 'finalize_verification: match is not awaiting a verification decision';
  end if;

  update public.item_matches set status = p_decision, updated_at = now() where id = p_match_id;

  insert into public.notifications (user_id, type, title, body, related_match_id)
  values (
    v_match.found_reporter,
    case when p_decision = 'VERIFIED' then 'MATCH_VERIFIED' else 'MATCH_REJECTED' end,
    case when p_decision = 'VERIFIED' then 'Ownership verified' else 'Verification unsuccessful' end,
    case
      when p_decision = 'VERIFIED' then 'The owner confirmed this is their item. You can now arrange a handoff.'
      else 'The owner was not able to verify ownership for this match.'
    end,
    p_match_id
  );
end;
$$;

-- ============================================================================
-- advance_recovery — moves VERIFIED -> RECOVERY_IN_PROGRESS -> RECOVERED.
-- Either participant may advance the handoff process.
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
  if p_status not in ('RECOVERY_IN_PROGRESS', 'RECOVERED') then
    raise exception 'advance_recovery: status must be RECOVERY_IN_PROGRESS or RECOVERED';
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
    or (v_match.status = 'RECOVERY_IN_PROGRESS' and p_status = 'RECOVERED');

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
-- Execute grants — these RPCs are the only way to write item_matches,
-- notifications, or match_verification_attempts, so authenticated users
-- must be able to call them. Each function performs its own auth.uid()
-- authorization checks internally.
-- ============================================================================
grant execute on function public.record_match(uuid, uuid, integer, jsonb, double precision, double precision) to authenticated;
grant execute on function public.reject_match(uuid) to authenticated;
grant execute on function public.request_match_verification(uuid) to authenticated;
grant execute on function public.get_verification_questions(uuid) to authenticated;
grant execute on function public.submit_verification_answer(uuid, text, text) to authenticated;
grant execute on function public.finalize_verification(uuid, text) to authenticated;
grant execute on function public.advance_recovery(uuid, text) to authenticated;

-- ============================================================================
-- Realtime — lets the notification bell update live without polling.
-- ============================================================================
alter publication supabase_realtime add table public.notifications;
