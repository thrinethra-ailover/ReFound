-- Only the owner/claimant can confirm that the returned item is in their hands.
-- A finder may coordinate the handoff, but cannot close the recovery alone.
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
  where m.id = p_match_id
  for update of m;

  if v_match.id is null then
    raise exception 'advance_recovery: match not found';
  end if;
  if auth.uid() is distinct from v_match.lost_reporter
    and auth.uid() is distinct from v_match.found_reporter then
    raise exception 'advance_recovery: only a participant may update recovery status';
  end if;
  if p_status = 'RECOVERED' and auth.uid() is distinct from v_match.lost_reporter then
    raise exception 'advance_recovery: only the owner may confirm receipt';
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
    case when p_status = 'RECOVERED' then 'Owner confirmed receipt' else 'Recovery in progress' end,
    case
      when p_status = 'RECOVERED' then 'The owner confirmed they received the item. Thanks for using ReFound!'
      else 'The other party started the recovery handoff process.'
    end,
    p_match_id
  );
end;
$$;

grant execute on function public.advance_recovery(uuid, text) to authenticated;
