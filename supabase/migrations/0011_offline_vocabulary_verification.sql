-- Expand blind ownership matching with a small offline vocabulary and common
-- English inflections. No model, network call, or additional service required.
-- Keep this canonicalization aligned with src/lib/matching/verification.ts.

create or replace function public.verification_tokens(p_value text)
returns text[]
language sql
immutable
parallel safe
set search_path = public
as $$
  with raw_tokens as (
    select token
    from regexp_split_to_table(
      regexp_replace(
        regexp_replace(lower(coalesce(p_value, '')),
          '\m(isn|aren|wasn|weren|don|doesn|didn|couldn|wouldn|shouldn|hasn|haven|hadn|mustn|can|won|shan|ain)(''''|’)t\M',
          ' not ', 'g'),
        '[^[:alnum:]]+', ' ', 'g'),
      ' +'
    ) as words(token)
    where token <> '' and token <> all(array[
      'a','an','the','this','that','these','those',
      'i','me','my','we','our','you','your','he','she','they','it','its',
      's','re','ve','ll','d','m','there','here','who','what','which',
      'am','is','are','was','were','be','being','been','have','has','had',
      'do','does','did','can','could','would','should','will','may','might','must',
      'and','or','but','if','then','as','than','on','in','at','to','of','with','by',
      'for','from','into','onto','over','under','near','about','around','through',
      'found','noticed','see','saw','because','while','when','also','just','really',
      'very','only','please','think','thought','believe','seem','seems','seemed',
      'look','looks','looked','maybe','probably','item','object','something'
    ]::text[])
  ), stemmed as (
    select case
      when token ~ '^[a-z]{5,}ies$' then regexp_replace(token, 'ies$', 'y')
      when token ~ '^[a-z]{5,}sses$' then regexp_replace(token, 'es$', '')
      when token ~ '^[a-z]{5,}xes$' then regexp_replace(token, 'es$', '')
      when token ~ '^[a-z]{5,}ches$' then regexp_replace(token, 'es$', '')
      when token ~ '^[a-z]{5,}shes$' then regexp_replace(token, 'es$', '')
      when token ~ '^[a-z]{5,}s$' and token !~ '(ss|us|is)$' then regexp_replace(token, 's$', '')
      when token ~ '^[a-z]{6,}ing$' then regexp_replace(regexp_replace(token, 'ing$', ''), '(.)\1$', '\1')
      when token ~ '^[a-z]{5,}ed$' then regexp_replace(regexp_replace(token, 'ed$', ''), '(.)\1$', '\1')
      else token
    end as token from raw_tokens
  ), canonicalized as (
    select case token
      when 'decal' then 'sticker' when 'zip' then 'zipper'
      when 'rucksack' then 'backpack' when 'knapsack' then 'backpack'
      when 'scuff' then 'scratch' when 'scrape' then 'scratch'
      when 'dent' then 'dent' when 'ding' then 'dent'
      when 'mark' then 'mark' when 'blemish' then 'mark'
      when 'colour' then 'color' when 'grey' then 'gray'
      when 'crimson' then 'red' when 'scarlet' then 'red' when 'maroon' then 'red'
      when 'navy' then 'blue' when 'azure' then 'blue'
      when 'tiny' then 'small' when 'little' then 'small' when 'miniature' then 'small'
      when 'huge' then 'large' when 'big' then 'large' when 'giant' then 'large'
      when 'top' then 'upper' when 'uppermost' then 'upper'
      when 'bottom' then 'lower' when 'lowermost' then 'lower'
      when 'spectacle' then 'glasses' when 'eyeglass' then 'glasses'
      when 'glass' then 'glasses'
      when 'handbag' then 'bag' when 'purse' then 'bag' when 'tote' then 'bag'
      when 'cellphone' then 'phone' when 'mobile' then 'phone' when 'smartphone' then 'phone'
      when 'sneaker' then 'shoe' when 'trainer' then 'shoe'
      when 'sweatshirt' then 'hoodie' when 'jumper' then 'sweater'
      when 'flask' then 'bottle' when 'thermos' then 'bottle'
      when 'soiled' then 'dirty' when 'filthy' then 'dirty'
      when 'spot' then 'stain' when 'stain' then 'stain'
      when 'not' then 'not'
      else token
    end as canonical_token from stemmed
  )
  select coalesce(array_agg(distinct canonical_token order by canonical_token), array[]::text[])
  from canonicalized where canonical_token <> '';
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
      select 1 from unnest(claimed) c(token) join unnest(actual) a(token)
      on (c.token='red' and a.token in ('blue','green','yellow','purple','orange','pink'))
      or (a.token='red' and c.token in ('blue','green','yellow','purple','orange','pink'))
      or (c.token='blue' and a.token in ('yellow','orange'))
      or (a.token='blue' and c.token in ('yellow','orange'))
      or (c.token='black' and a.token='white') or (c.token='white' and a.token='black')
      or (c.token='left' and a.token='right') or (c.token='right' and a.token='left')
      or (c.token='upper' and a.token='lower') or (c.token='lower' and a.token='upper')
      or (c.token='front' and a.token='back') or (c.token='back' and a.token='front')
      or (c.token='inside' and a.token='outside') or (c.token='outside' and a.token='inside')
      or (c.token='small' and a.token='large') or (c.token='large' and a.token='small')
      or (c.token='new' and a.token='old') or (c.token='old' and a.token='new')
    ) then false
    when shared < 2 then false
    else shared::numeric / greatest(cardinality(claimed), cardinality(actual)) >= 0.6666666667
  end from overlap;
$$;

revoke all on function public.verification_tokens(text) from public, anon, authenticated;
revoke all on function public.verification_answers_match(text, text) from public, anon, authenticated;
