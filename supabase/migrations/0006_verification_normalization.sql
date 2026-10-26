-- Keep ownership verification tolerant of harmless capitalization and
-- whitespace differences while continuing to compare the complete answer.
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
    and regexp_replace(lower(trim(v_actual_value)), '\s+', ' ', 'g')
      = regexp_replace(lower(trim(coalesce(p_answer, ''))), '\s+', ' ', 'g');

  insert into public.match_verification_attempts (match_id, attribute_key, is_correct, attempted_by)
  values (p_match_id, p_attribute_key, coalesce(v_is_correct, false), auth.uid());

  return coalesce(v_is_correct, false);
end;
$$;
