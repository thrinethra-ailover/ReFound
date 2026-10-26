-- Correct the ownership verification direction:
-- the claimant answers private details saved by the finder, and the finder
-- reviews the boolean results before accepting the claim.

-- The finder may review boolean results for both participants. Raw guesses are
-- never stored in this table.
drop policy if exists "match_verification_attempts_select_participants"
  on public.match_verification_attempts;
create policy "match_verification_attempts_select_participants"
  on public.match_verification_attempts for select
  to authenticated
  using (
    exists (
      select 1
      from public.item_matches m
      join public.items l on l.id = m.lost_item_id
      join public.items f on f.id = m.found_item_id
      where m.id = match_verification_attempts.match_id
        and auth.uid() in (l.reporter_id, f.reporter_id)
    )
  );

create or replace function public.get_verification_questions(p_match_id uuid)
returns table (attribute_key text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
begin
  select m.id, m.status, l.reporter_id as claimant_id, f.id as found_item_id
  into v_match
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = p_match_id;

  if v_match.id is null then
    raise exception 'get_verification_questions: match not found';
  end if;
  if auth.uid() is distinct from v_match.claimant_id then
    raise exception 'get_verification_questions: only the claimant answers verification questions';
  end if;
  if v_match.status <> 'VERIFICATION_PENDING' then
    raise exception 'get_verification_questions: match is not in verification';
  end if;

  return query
    select a.attribute_key
    from public.item_verification_attributes a
    where a.item_id = v_match.found_item_id
    order by a.created_at;
end;
$$;

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
  v_attempt_count integer;
begin
  select m.id, m.status, l.reporter_id as claimant_id,
         f.id as found_item_id, f.reporter_id as finder_id
  into v_match
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = p_match_id
  for update of m;

  if v_match.id is null then
    raise exception 'submit_verification_answer: match not found';
  end if;
  if auth.uid() is distinct from v_match.claimant_id then
    raise exception 'submit_verification_answer: only the claimant submits verification answers';
  end if;
  if v_match.status <> 'VERIFICATION_PENDING' then
    raise exception 'submit_verification_answer: match is not in verification';
  end if;
  if length(trim(coalesce(p_answer, ''))) = 0 or length(p_answer) > 500 then
    raise exception 'submit_verification_answer: answer must be between 1 and 500 characters';
  end if;

  select a.attribute_value into v_actual_value
  from public.item_verification_attributes a
  where a.item_id = v_match.found_item_id
    and a.attribute_key = p_attribute_key;

  if v_actual_value is null then
    raise exception 'submit_verification_answer: question not found';
  end if;

  select count(*) into v_attempt_count
  from public.match_verification_attempts a
  where a.match_id = p_match_id
    and a.attribute_key = p_attribute_key
    and a.attempted_by = v_match.claimant_id;
  if v_attempt_count >= 3 then
    raise exception 'submit_verification_answer: maximum attempts reached for this detail';
  end if;

  v_is_correct := public.normalize_verification_answer(v_actual_value) <> ''
    and public.normalize_verification_answer(v_actual_value)
      = public.normalize_verification_answer(p_answer);

  insert into public.match_verification_attempts (match_id, attribute_key, is_correct, attempted_by)
  values (p_match_id, p_attribute_key, coalesce(v_is_correct, false), v_match.claimant_id);

  -- Let the finder know when the claimant has submitted at least one answer
  -- for every prompt. The notification contains no answers or private values.
  if not exists (
    select 1
    from public.item_verification_attributes a
    where a.item_id = v_match.found_item_id
      and not exists (
        select 1
        from public.match_verification_attempts v
        where v.match_id = p_match_id
          and v.attribute_key = a.attribute_key
          and v.attempted_by = v_match.claimant_id
      )
  ) and not exists (
    select 1 from public.notifications n
    where n.related_match_id = p_match_id
      and n.user_id = v_match.finder_id
      and n.type = 'VERIFICATION_UPDATE'
  ) then
    insert into public.notifications (user_id, type, title, body, related_match_id)
    values (
      v_match.finder_id,
      'VERIFICATION_UPDATE',
      'Ownership answers ready to review',
      'The claimant answered the private verification questions. Review the match results before arranging a handoff.',
      p_match_id
    );
  end if;

  return coalesce(v_is_correct, false);
end;
$$;

create or replace function public.finalize_verification(p_match_id uuid, p_decision text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
  v_attribute_count integer;
begin
  if p_decision not in ('VERIFIED', 'REJECTED') then
    raise exception 'finalize_verification: decision must be VERIFIED or REJECTED';
  end if;

  select m.id, m.status, l.reporter_id as claimant_id,
         f.reporter_id as finder_id, f.id as found_item_id
  into v_match
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = p_match_id
  for update of m;

  if v_match.id is null then
    raise exception 'finalize_verification: match not found';
  end if;
  if auth.uid() is distinct from v_match.finder_id then
    raise exception 'finalize_verification: only the finder can decide whether to accept the claim';
  end if;
  if v_match.status <> 'VERIFICATION_PENDING' then
    raise exception 'finalize_verification: match is not awaiting a verification decision';
  end if;

  if p_decision = 'VERIFIED' then
    select count(*) into v_attribute_count
    from public.item_verification_attributes a
    where a.item_id = v_match.found_item_id;

    if v_attribute_count = 0 then
      raise exception 'finalize_verification: the found report has no private details to verify';
    end if;
    if exists (
      select 1
      from public.item_verification_attributes a
      where a.item_id = v_match.found_item_id
        and not exists (
          select 1
          from public.match_verification_attempts v
          where v.match_id = p_match_id
            and v.attribute_key = a.attribute_key
            and v.attempted_by = v_match.claimant_id
            and v.is_correct
        )
    ) then
      raise exception 'finalize_verification: every private detail must be answered correctly before accepting the claim';
    end if;
  end if;

  update public.item_matches
  set status = p_decision, updated_at = now()
  where id = p_match_id;

  insert into public.notifications (user_id, type, title, body, related_match_id)
  values (
    v_match.claimant_id,
    case when p_decision = 'VERIFIED' then 'MATCH_VERIFIED' else 'MATCH_REJECTED' end,
    case when p_decision = 'VERIFIED' then 'Ownership claim accepted' else 'Ownership claim rejected' end,
    case
      when p_decision = 'VERIFIED' then 'The finder accepted your ownership claim. You can arrange a handoff now.'
      else 'The finder could not accept your ownership claim for this match.'
    end,
    p_match_id
  );
end;
$$;

grant execute on function public.get_verification_questions(uuid) to authenticated;
grant execute on function public.submit_verification_answer(uuid, text, text) to authenticated;
grant execute on function public.finalize_verification(uuid, text) to authenticated;
