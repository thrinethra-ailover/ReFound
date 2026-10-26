-- A maintainable, offline synonym lexicon for ownership answers. The table has
-- no client policies and its contents are only used inside the comparison RPC.
create table if not exists public.verification_vocabulary (
  alias text primary key,
  canonical text not null
);

alter table public.verification_vocabulary enable row level security;
revoke all on public.verification_vocabulary from public, anon, authenticated;

insert into public.verification_vocabulary(alias, canonical) values
  -- Marks and damage
  ('decal','sticker'), ('scuff','scratch'), ('scrape','scratch'), ('abrasion','scratch'), ('scratchmark','scratch'),
  ('blemish','mark'), ('spot','stain'), ('smudge','stain'), ('streak','mark'),
  ('dent','dent'), ('ding','dent'), ('notch','chip'), ('nick','chip'), ('chip','chip'),
  ('crack','crack'), ('fracture','crack'), ('tear','tear'), ('tore','tear'), ('torn','tear'), ('rip','tear'),
  ('stain','stain'), ('discoloration','stain'), ('discolouration','stain'),
  ('fold','crease'), ('crease','crease'),
  -- Common object names and regional wording
  ('rucksack','backpack'), ('knapsack','backpack'), ('satchel','bag'), ('handbag','bag'),
  ('purse','bag'), ('tote','bag'), ('wallet','wallet'), ('billfold','wallet'),
  ('cellphone','phone'), ('mobile','phone'), ('smartphone','phone'), ('handset','phone'),
  ('spectacle','glasses'), ('eyeglass','glasses'), ('glass','glasses'),
  ('sneaker','shoe'), ('trainer','shoe'), ('footwear','shoe'),
  ('flask','bottle'), ('thermos','bottle'), ('canteen','bottle'),
  ('notepad','notebook'), ('journal','notebook'), ('exercisebook','notebook'),
  ('biro','pen'), ('markerpen','marker'), ('highlighterpen','highlighter'),
  ('jumper','sweater'), ('pullover','sweater'), ('sweatshirt','hoodie'),
  ('coat','jacket'), ('parka','jacket'), ('windbreaker','jacket'),
  ('tee','shirt'), ('tshirt','shirt'),
  ('earbuds','earbud'), ('earphone','earbud'), ('headphones','headphone'),
  ('keyring','keychain'), ('keyfob','keychain'),
  -- Surface, shape, and position wording
  ('uppermost','upper'), ('top','upper'), ('bottom','lower'), ('lowermost','lower'),
  ('beneath','under'), ('underneath','under'), ('below','under'), ('above','over'),
  ('rear','back'), ('backside','back'), ('reverse','back'), ('opposite','back'),
  ('edge','edge'), ('rim','edge'), ('border','edge'), ('outline','edge'),
  ('middle','center'), ('centre','center'), ('central','center'),
  ('circular','round'), ('round','round'), ('rounded','round'),
  ('rectangular','rectangle'), ('rectangle','rectangle'),
  -- Size and appearance
  ('tiny','small'), ('little','small'), ('miniature','small'), ('compact','small'),
  ('huge','large'), ('big','large'), ('giant','large'), ('enormous','large'),
  ('slim','thin'), ('skinny','thin'), ('narrow','thin'),
  ('thick','wide'), ('broad','wide'),
  ('shiny','glossy'), ('lustrous','glossy'), ('matte','dull'), ('matt','dull'),
  ('faded','worn'), ('wornout','worn'), ('weathered','worn'),
  -- Color variants; do not collapse distinct base colors together
  ('colour','color'), ('grey','gray'), ('charcoal','gray'),
  ('crimson','red'), ('scarlet','red'), ('maroon','red'), ('burgundy','red'),
  ('navy','blue'), ('azure','blue'), ('teal','teal'), ('turquoise','teal'),
  ('violet','purple'), ('lilac','purple'), ('lavender','purple'),
  ('tan','brown'), ('beige','brown'), ('cream','white'), ('ivory','white'),
  -- Common material wording
  ('leather','leather'), ('leathery','leather'), ('denim','denim'), ('jean','denim'),
  ('metal','metal'), ('metallic','metal'), ('steel','metal'), ('aluminium','metal'), ('aluminum','metal'),
  ('plastic','plastic'), ('rubber','rubber'), ('canvas','canvas'), ('fabric','fabric'),
  ('cloth','fabric'), ('wooden','wood'), ('wood','wood'),
  -- Form normalization aliases after the lightweight stemmer
  ('sticker','sticker'), ('zip','zipper'), ('zipper','zipper'),
  ('color','color'), ('gray','gray'), ('dirty','dirty'), ('clean','clean'), ('cannot','not')
on conflict (alias) do update set canonical = excluded.canonical;

create or replace function public.verification_tokens(p_value text)
returns text[]
language sql
stable
parallel safe
set search_path = public
as $$
  with raw_tokens as (
    select token
    from regexp_split_to_table(
      regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(coalesce(p_value, '')), '\mcell\s+phone\M', 'cellphone', 'g'),
              '\mt\s+shirt\M', 'tshirt', 'g'),
            '\mworn\s+out\M', 'wornout', 'g'),
          '\mkey\s+chain\M', 'keychain', 'g'),
          '\m(isn|aren|wasn|weren|don|doesn|didn|couldn|wouldn|shouldn|hasn|haven|hadn|mustn|can|won|shan|ain)(''''|’)t\M',
          ' not ', 'g'),
        '[^[:alnum:]]+', ' ', 'g'),
      ' +'
    ) as words(token)
    where token <> '' and token <> all(array[
      'a','an','the','this','that','these','those','there','here','who','what','which',
      'i','me','my','we','our','you','your','he','she','they','it','its','mine','yours',
      'am','is','are','was','were','be','being','been','have','has','had','do','does','did',
      'can','could','would','should','will','may','might','must','and','or','but','if','then',
      'as','than','on','in','at','to','of','with','by','for','from','into','onto',
      'near','about','around','through','because','while','when','also','just','really','very',
      'only','please','think','thought','believe','seem','seems','seemed','look','looks','looked',
      'maybe','probably','item','object','something','found','noticed','see','saw','has','got',
      'there','some','any','more','most','very','like','kind','sort','type','bit','piece','part'
    ]::text[])
  ), stemmed as (
    select case
      when token ~ '^[a-z]{5,}ies$' then regexp_replace(token, 'ies$', 'y')
      when token ~ '^[a-z]{5,}(sses|xes|ches|shes)$' then regexp_replace(token, 'es$', '')
      when token ~ '^[a-z]{5,}s$' and token !~ '(ss|us|is)$' then regexp_replace(token, 's$', '')
      when token ~ '^[a-z]{6,}ing$' then regexp_replace(regexp_replace(token, 'ing$', ''), '(.)\1$', '\1')
      when token ~ '^[a-z]{5,}ed$' then regexp_replace(regexp_replace(token, 'ed$', ''), '(.)\1$', '\1')
      else token
    end as token from raw_tokens
  )
  select coalesce(array_agg(distinct coalesce(v.canonical, s.token) order by coalesce(v.canonical, s.token)), array[]::text[])
  from stemmed s
  left join public.verification_vocabulary v on v.alias = s.token;
$$;

revoke all on function public.verification_tokens(text) from public, anon, authenticated;
alter function public.verification_answers_match(text, text) stable;
