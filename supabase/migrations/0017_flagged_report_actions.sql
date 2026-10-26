-- Atomically carry out a moderator action from a community report flag.
create or replace function public.admin_act_on_report_flag(p_flag_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_item_id uuid;
  v_title text;
  v_item_status text;
  v_reason text;
  v_flag_status text;
  v_new_item_status text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_action not in ('RESOLVE','DEACTIVATE') then raise exception 'Invalid report action'; end if;

  select f.item_id, i.title, i.status, f.reason, f.status
    into v_item_id, v_title, v_item_status, v_reason, v_flag_status
  from public.report_abuse_flags f
  join public.items i on i.id = f.item_id
  where f.id = p_flag_id
  for update of f, i;

  if v_item_id is null then raise exception 'Flagged report was not found'; end if;
  if v_flag_status <> 'PENDING' then raise exception 'This flag has already been reviewed'; end if;
  if v_item_status <> 'ACTIVE' then raise exception 'This report is no longer active'; end if;

  v_new_item_status := case when p_action = 'RESOLVE' then 'RESOLVED' else 'CANCELLED' end;
  update public.items set status = v_new_item_status, updated_at = now() where id = v_item_id;
  update public.report_abuse_flags set status = 'REVIEWED', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_flag_id;

  perform public.log_audit_event('ADMIN_ACTION', auth.uid(), 'item', v_item_id,
    jsonb_build_object('action', case when p_action = 'RESOLVE' then 'resolve' else 'deactivate' end,
      'source', 'community_report_flag', 'flag_id', p_flag_id, 'reason', v_reason));
  perform public.log_audit_event('ADMIN_ACTION', auth.uid(), 'report_abuse_flags', p_flag_id,
    jsonb_build_object('action', 'ACT_ON_REPORT_FLAG', 'moderator_action', p_action, 'item_title', v_title));
end;
$$;
revoke all on function public.admin_act_on_report_flag(uuid,text) from public, anon;
grant execute on function public.admin_act_on_report_flag(uuid,text) to authenticated;
