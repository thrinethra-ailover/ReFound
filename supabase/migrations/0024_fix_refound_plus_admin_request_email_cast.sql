-- auth.users.email is varchar; the admin RPC declares user_email as text.
-- Cast explicitly so PL/pgSQL RETURN QUERY has the exact declared result type.
create or replace function public.admin_list_refound_plus_payment_requests()
returns table(
  id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  amount_inr integer,
  plan text,
  period_days integer,
  status text,
  utr text,
  admin_note text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
    select r.id, r.user_id, p.full_name, u.email::text, r.amount_inr, r.plan,
      r.period_days, r.status, r.utr, r.admin_note, r.created_at
    from public.refound_plus_payment_requests r
    join public.profiles p on p.id = r.user_id
    join auth.users u on u.id = r.user_id
    order by case when r.status = 'PENDING_REVIEW' then 0
      when r.status = 'AWAITING_PAYMENT' then 1 else 2 end, r.created_at desc;
end;
$$;

revoke all on function public.admin_list_refound_plus_payment_requests() from public, anon, authenticated;
grant execute on function public.admin_list_refound_plus_payment_requests() to authenticated;
