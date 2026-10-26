-- ReFound — optional user-to-admin support chat with an admin-controlled switch.
alter table public.app_settings
  add column admin_support_chat_enabled boolean not null default false;

create table public.admin_support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_support_conversations_updated_at_idx
  on public.admin_support_conversations(updated_at desc);

create table public.admin_support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.admin_support_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index admin_support_messages_conversation_created_idx
  on public.admin_support_messages(conversation_id, created_at);

alter table public.admin_support_conversations enable row level security;
alter table public.admin_support_messages enable row level security;
revoke all on public.admin_support_conversations, public.admin_support_messages from public, anon;
grant select, insert on public.admin_support_conversations to authenticated;
grant select, insert on public.admin_support_messages to authenticated;

create or replace function public.get_admin_support_chat_enabled()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select admin_support_chat_enabled from public.app_settings where singleton), false);
$$;

create or replace function public.admin_set_support_chat_enabled(p_enabled boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Support chat settings require admin access';
  end if;
  update public.app_settings
    set admin_support_chat_enabled = p_enabled, updated_at = now(), updated_by = auth.uid()
    where singleton;
  perform public.log_audit_event(
    'ADMIN_ACTION', auth.uid(), 'app_settings', null,
    jsonb_build_object('action', 'UPDATE_ADMIN_SUPPORT_CHAT', 'enabled', p_enabled)
  );
end;
$$;

revoke all on function public.get_admin_support_chat_enabled() from public, anon;
revoke all on function public.admin_set_support_chat_enabled(boolean) from public, anon;
grant execute on function public.get_admin_support_chat_enabled() to authenticated;
grant execute on function public.admin_set_support_chat_enabled(boolean) to authenticated;

create policy admin_support_conversations_read_participants
  on public.admin_support_conversations for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy admin_support_conversations_create_own_when_enabled
  on public.admin_support_conversations for insert to authenticated
  with check (user_id = auth.uid() and not public.is_admin() and public.get_admin_support_chat_enabled());

create policy admin_support_messages_read_participants
  on public.admin_support_messages for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.admin_support_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy admin_support_messages_send_participant
  on public.admin_support_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or (
        public.get_admin_support_chat_enabled()
        and exists (
          select 1 from public.admin_support_conversations c
          where c.id = conversation_id and c.user_id = auth.uid()
        )
      )
    )
  );

-- Apply the existing campus verification gate to support data as well.
create policy admin_support_conversations_campus_gate
  on public.admin_support_conversations as restrictive for all to authenticated
  using (public.campus_access_allowed()) with check (public.campus_access_allowed());
create policy admin_support_messages_campus_gate
  on public.admin_support_messages as restrictive for all to authenticated
  using (public.campus_access_allowed()) with check (public.campus_access_allowed());

create or replace function public.touch_admin_support_conversation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.admin_support_conversations
    set updated_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.touch_admin_support_conversation() from public, anon, authenticated;
create trigger touch_admin_support_conversation_after_message
  after insert on public.admin_support_messages
  for each row execute function public.touch_admin_support_conversation();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_support_conversations'
  ) then
    alter publication supabase_realtime add table public.admin_support_conversations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_support_messages'
  ) then
    alter publication supabase_realtime add table public.admin_support_messages;
  end if;
end;
$$;
