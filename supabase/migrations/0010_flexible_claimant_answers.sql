-- Give claimants more room to answer and compare meaningful details without
-- requiring an exact sentence. Common grammar, order, selected word variants,
-- and a limited amount of extra/omitted wording are tolerated; conflicting
-- same-length details (such as left vs. right) still fail.

create or replace function public.verification_tokens(p_value text)
returns text[]
language sql
immutable
parallel safe
set search_path = public
as $$
  select coalesce(array_agg(distinct canonical_token order by canonical_token), array[]::text[])
  from (
    select case token
      when 'decal' then 'sticker'
      when 'decals' then 'sticker'
      when 'stickers' then 'sticker'
      when 'zip' then 'zipper'
      when 'zips' then 'zipper'
      when 'zippers' then 'zipper'
      when 'rucksack' then 'backpack'
      when 'rucksacks' then 'backpack'
      when 'backpacks' then 'backpack'
      when 'scratches' then 'scratch'
      when 'scratched' then 'scratch'
      when 'scratching' then 'scratch'
      when 'scuff' then 'scratch'
      when 'scuffs' then 'scratch'
      when 'scuffed' then 'scratch'
      when 'scuffing' then 'scratch'
      when 'dents' then 'dent'
      when 'dented' then 'dent'
      when 'marks' then 'mark'
      when 'marked' then 'mark'
      when 'stars' then 'star'
      when 'corners' then 'corner'
      when 'pockets' then 'pocket'
      when 'straps' then 'strap'
      when 'buttons' then 'button'
      when 'keys' then 'key'
      when 'cracks' then 'crack'
      when 'cracked' then 'crack'
      when 'cracking' then 'crack'
      when 'tears' then 'tear'
      when 'tore' then 'tear'
      when 'torn' then 'tear'
      when 'stains' then 'stain'
      when 'stained' then 'stain'
      when 'staining' then 'stain'
      when 'folds' then 'fold'
      when 'folded' then 'fold'
      when 'folding' then 'fold'
      when 'stripes' then 'stripe'
      when 'labels' then 'label'
      when 'colours' then 'color'
      when 'colour' then 'color'
      when 'grey' then 'gray'
      when 'centres' then 'center'
      when 'centre' then 'center'
      when 'cannot' then 'not'
      when 'little' then 'small'
      when 'tiny' then 'small'
      when 'big' then 'large'
      when 'huge' then 'large'
      when 'top' then 'upper'
      when 'uppermost' then 'upper'
      when 'bottom' then 'lower'
      when 'lower' then 'lower'
      when 'lowermost' then 'lower'
      when 'crimson' then 'red'
      when 'scarlet' then 'red'
      when 'navy' then 'blue'
      else token
    end as canonical_token
    from regexp_split_to_table(
      regexp_replace(
        regexp_replace(
          lower(coalesce(p_value, '')),
          '\m(isn|aren|wasn|weren|don|doesn|didn|couldn|wouldn|shouldn|hasn|haven|hadn|mustn|can|won|shan|ain)(''|’)t\M',
          ' not ', 'g'
        ),
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
        'found','noticed','see','saw',
        'because','while','when','also','just','really','very','only','please',
        'think','thought','believe','seem','seems','seemed','look','looks','looked',
        'maybe','probably','item','object','something'
      ]::text[])
  ) as tokens;
$$;

create or replace function public.verification_answers_match(p_claimed text, p_actual text)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  with token_sets as (
    select public.verification_tokens(p_claimed) as claimed,
           public.verification_tokens(p_actual) as actual
  ), overlap as (
    select claimed, actual,
      (select count(*) from unnest(claimed) as u(token) where u.token = any(actual))::integer as shared
    from token_sets
  )
  select case
    when cardinality(claimed) = 0 or cardinality(actual) = 0 then false
    when claimed = actual then true
    when exists (
      select 1
      from unnest(claimed) as c(token)
      join unnest(actual) as a(token)
        on (c.token = 'red' and a.token = 'blue') or (c.token = 'blue' and a.token = 'red')
        or (c.token = 'black' and a.token = 'white') or (c.token = 'white' and a.token = 'black')
        or (c.token = 'green' and a.token = 'red') or (c.token = 'red' and a.token = 'green')
        or (c.token = 'yellow' and a.token = 'purple') or (c.token = 'purple' and a.token = 'yellow')
        or (c.token = 'orange' and a.token = 'blue') or (c.token = 'blue' and a.token = 'orange')
        or (c.token = 'pink' and a.token = 'brown') or (c.token = 'brown' and a.token = 'pink')
        or (c.token = 'silver' and a.token = 'gold') or (c.token = 'gold' and a.token = 'silver')
        or (c.token = 'left' and a.token = 'right') or (c.token = 'right' and a.token = 'left')
        or (c.token = 'top' and a.token = 'bottom') or (c.token = 'bottom' and a.token = 'top')
        or (c.token = 'front' and a.token = 'back') or (c.token = 'back' and a.token = 'front')
        or (c.token = 'inside' and a.token = 'outside') or (c.token = 'outside' and a.token = 'inside')
        or (c.token = 'upper' and a.token = 'lower') or (c.token = 'lower' and a.token = 'upper')
        or (c.token = 'north' and a.token = 'south') or (c.token = 'south' and a.token = 'north')
        or (c.token = 'east' and a.token = 'west') or (c.token = 'west' and a.token = 'east')
        or (c.token = 'small' and a.token in ('large', 'big'))
        or (c.token in ('large', 'big') and a.token = 'small')
        or (c.token = 'new' and a.token = 'old') or (c.token = 'old' and a.token = 'new')
    ) then false
    when cardinality(claimed) = cardinality(actual) then false
    when shared < 2 then false
    when cardinality(claimed) < cardinality(actual) then
      shared = cardinality(claimed)
      and shared::numeric / cardinality(actual) >= 0.6666666667
    else
      shared = cardinality(actual)
      and shared::numeric / cardinality(claimed) >= 0.6666666667
  end
  from overlap;
$$;

revoke all on function public.verification_tokens(text) from public, anon, authenticated;
revoke all on function public.verification_answers_match(text, text) from public, anon, authenticated;

-- Return the remaining-tries counter without returning any saved answer.
drop function public.get_verification_questions(uuid);
create function public.get_verification_questions(p_match_id uuid)
returns table (attribute_key text, attempts_used integer)
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
    select a.attribute_key, count(v.id)::integer
    from public.item_verification_attributes a
    left join public.match_verification_attempts v
      on v.match_id = p_match_id
      and v.attribute_key = a.attribute_key
      and v.attempted_by = v_match.claimant_id
    where a.item_id = v_match.found_item_id
    group by a.attribute_key, a.created_at
    order by a.created_at;
end;
$$;

revoke all on function public.get_verification_questions(uuid) from public, anon;

-- Finder-only summary of every expected detail, including unanswered prompts.
-- It returns only a count and a boolean result, never the claimant's answer
-- or the saved private value.
create or replace function public.get_verification_review(p_match_id uuid)
returns table (attribute_key text, attempts_used integer, is_correct boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
begin
  select m.id, m.status, l.reporter_id as claimant_id, f.id as found_item_id,
         f.reporter_id as finder_id
  into v_match
  from public.item_matches m
  join public.items l on l.id = m.lost_item_id
  join public.items f on f.id = m.found_item_id
  where m.id = p_match_id;

  if v_match.id is null then
    raise exception 'get_verification_review: match not found';
  end if;
  if auth.uid() is distinct from v_match.finder_id then
    raise exception 'get_verification_review: only the finder can review verification results';
  end if;
  if v_match.status <> 'VERIFICATION_PENDING' then
    raise exception 'get_verification_review: match is not in verification';
  end if;

  return query
    select a.attribute_key, count(v.id)::integer, coalesce(bool_or(v.is_correct), false)
    from public.item_verification_attributes a
    left join public.match_verification_attempts v
      on v.match_id = p_match_id
      and v.attribute_key = a.attribute_key
      and v.attempted_by = v_match.claimant_id
    where a.item_id = v_match.found_item_id
    group by a.attribute_key, a.created_at
    order by a.created_at;
end;
$$;

revoke all on function public.get_verification_review(uuid) from public, anon;

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
  if v_attempt_count >= 5 then
    raise exception 'submit_verification_answer: maximum attempts reached for this detail';
  end if;

  v_is_correct := public.verification_answers_match(p_answer, v_actual_value);
  insert into public.match_verification_attempts (match_id, attribute_key, is_correct, attempted_by)
  values (p_match_id, p_attribute_key, coalesce(v_is_correct, false), v_match.claimant_id);

  if not exists (
    select 1
    from public.item_verification_attributes a
    where a.item_id = v_match.found_item_id
      and not exists (
        select 1 from public.match_verification_attempts v
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

grant execute on function public.get_verification_questions(uuid) to authenticated;
grant execute on function public.submit_verification_answer(uuid, text, text) to authenticated;
grant execute on function public.get_verification_review(uuid) to authenticated;
