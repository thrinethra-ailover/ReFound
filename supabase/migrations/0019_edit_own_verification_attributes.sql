-- Allow the owner of a found report to atomically replace its private
-- verification details through a narrowly scoped RPC.
create or replace function public.replace_own_item_verification_attributes(
  p_item_id uuid,
  p_attributes jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report_type text;
  v_attribute jsonb;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to edit private verification details';
  end if;

  select i.report_type into v_report_type
  from public.items i
  where i.id = p_item_id and i.reporter_id = auth.uid()
  for update;

  if not found or v_report_type <> 'FOUND' then
    raise exception 'Only the finder can edit verification details on their found report';
  end if;

  if jsonb_typeof(p_attributes) is distinct from 'array' then
    raise exception 'Verification details must be a list';
  end if;
  v_count := jsonb_array_length(p_attributes);
  if v_count < 1 or v_count > 5 then
    raise exception 'Add between one and five private verification details';
  end if;

  for v_attribute in select value from jsonb_array_elements(p_attributes)
  loop
    if jsonb_typeof(v_attribute) is distinct from 'object'
      or jsonb_typeof(v_attribute->'key') is distinct from 'string'
      or jsonb_typeof(v_attribute->'value') is distinct from 'string'
      or char_length(btrim(v_attribute->>'key')) not between 1 and 80
      or char_length(btrim(v_attribute->>'value')) not between 1 and 300 then
      raise exception 'Each detail needs a prompt and an answer within the allowed length';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_attributes) as attrs(element)
    group by lower(btrim(element->>'key'))
    having count(*) > 1
  ) then
    raise exception 'Each verification prompt must be unique';
  end if;

  if exists (
    select 1
    from public.item_matches m
    join public.match_verification_attempts a on a.match_id = m.id
    where m.found_item_id = p_item_id
  ) then
    raise exception 'Private details cannot be changed after a claimant has submitted an answer';
  end if;

  delete from public.item_verification_attributes where item_id = p_item_id;
  insert into public.item_verification_attributes(item_id, attribute_key, attribute_value)
  select p_item_id, btrim(element->>'key'), btrim(element->>'value')
  from jsonb_array_elements(p_attributes) as attrs(element);
end;
$$;

revoke all on function public.replace_own_item_verification_attributes(uuid, jsonb) from public, anon;
grant execute on function public.replace_own_item_verification_attributes(uuid, jsonb) to authenticated;
