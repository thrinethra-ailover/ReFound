-- Ignore common grammar and sentence-framing words while preserving the
-- distinctive content words. The private answer remains server-side and
-- this helper is only callable through the guarded verification RPC.
create or replace function public.normalize_verification_answer(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select coalesce(string_agg(token, ' ' order by token), '')
  from regexp_split_to_table(
    regexp_replace(
      lower(coalesce(p_value, '')),
      '[^[:alnum:]]+', ' ', 'g'
    ),
    ' +'
  ) as words(token)
  where token <> ''
    and token <> all(array[
      'a','an','the','this','that','these','those',
      'i','me','my','we','our','you','your','he','she','they','it','its','s','re','ve','ll','d','m',
      'there','here','who','what','which',
      'am','is','are','was','were','be','being','been',
      'have','has','had','do','does','did',
      'can','could','would','should','will','may','might','must',
      'and','or','but','if','then','as','than',
      'on','in','at','to','of','with','by','for','from','into','onto','over','under',
      'near','about','around','through',
      'found','noticed','see','saw'
    ]::text[]);
$$;

revoke all on function public.normalize_verification_answer(text) from public;
revoke all on function public.normalize_verification_answer(text) from anon, authenticated;

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
    and public.normalize_verification_answer(v_actual_value) <> ''
    and public.normalize_verification_answer(v_actual_value)
      = public.normalize_verification_answer(coalesce(p_answer, ''));

  insert into public.match_verification_attempts (match_id, attribute_key, is_correct, attempted_by)
  values (p_match_id, p_attribute_key, coalesce(v_is_correct, false), auth.uid());

  return coalesce(v_is_correct, false);
end;
$$;
