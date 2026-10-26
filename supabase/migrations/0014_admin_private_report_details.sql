-- Admins may inspect one active report's private verification details on
-- demand. Do not grant table access to item_verification_attributes.
create or replace function public.admin_get_active_report_details(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report jsonb;
  v_attribute_count integer;
  v_report_type text;
begin
  if not public.is_admin() then
    raise exception 'admin_get_active_report_details: admin access required';
  end if;

  select jsonb_build_object(
    'id', i.id,
    'report_type', i.report_type,
    'title', i.title,
    'description', i.description,
    'category', i.category,
    'color', i.color,
    'item_datetime', i.item_datetime,
    'location_name', i.location_name,
    'status', i.status,
    'created_at', i.created_at,
    'updated_at', i.updated_at,
    'item_images', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', im.id,
        'item_id', im.item_id,
        'storage_path', im.storage_path,
        'is_primary', im.is_primary,
        'created_at', im.created_at
      ) order by im.is_primary desc, im.created_at)
      from public.item_images im where im.item_id = i.id
    ), '[]'::jsonb),
    'verification_attributes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', va.id,
        'item_id', va.item_id,
        'attribute_key', va.attribute_key,
        'attribute_value', va.attribute_value,
        'created_at', va.created_at
      ) order by va.created_at)
      from public.item_verification_attributes va where va.item_id = i.id
    ), '[]'::jsonb)
  ), i.report_type
  into v_report, v_report_type
  from public.items i
  where i.id = p_item_id and i.status = 'ACTIVE';

  if v_report is null then
    raise exception 'admin_get_active_report_details: active report not found';
  end if;

  v_attribute_count := jsonb_array_length(v_report->'verification_attributes');
  perform public.log_audit_event(
    'ADMIN_ACTION', auth.uid(), 'item', p_item_id,
    jsonb_build_object(
      'action', 'VIEW_HIDDEN_REPORT_DETAILS',
      'report_type', v_report_type,
      'hidden_attribute_count', v_attribute_count
    )
  );

  return v_report;
end;
$$;

revoke all on function public.admin_get_active_report_details(uuid) from public, anon;
grant execute on function public.admin_get_active_report_details(uuid) to authenticated;
