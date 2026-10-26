import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AdminSupportConversation, AdminSupportMessage } from '../types/database';

export async function fetchSupportChatEnabled(): Promise<{ enabled: boolean; error: string | null }> {
  const { data, error } = await supabase.rpc('get_admin_support_chat_enabled');
  return { enabled: data === true, error: error?.message ?? null };
}

export async function setSupportChatEnabled(enabled: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_set_support_chat_enabled', { p_enabled: enabled });
  return { error: error?.message ?? null };
}

export async function getOrCreateSupportConversation(
  userId: string
): Promise<{ conversationId: string | null; error: string | null }> {
  const { data: existing, error: readError } = await supabase
    .from('admin_support_conversations')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) return { conversationId: null, error: readError.message };
  if (existing?.id) return { conversationId: existing.id, error: null };

  const { data: created, error: createError } = await supabase
    .from('admin_support_conversations')
    .insert({ user_id: userId })
    .select('id')
    .single();
  if (!createError && created) return { conversationId: created.id, error: null };

  // If another tab created the unique per-user thread concurrently, reuse it.
  const { data: raced } = await supabase
    .from('admin_support_conversations')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (raced?.id) return { conversationId: raced.id, error: null };
  return { conversationId: null, error: createError?.message ?? 'Could not open support chat.' };
}

export async function fetchSupportMessages(
  conversationId: string
): Promise<{ messages: AdminSupportMessage[]; error: string | null }> {
  const { data, error } = await supabase
    .from('admin_support_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(300);
  return { messages: (data ?? []) as AdminSupportMessage[], error: error?.message ?? null };
}

export async function sendSupportMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<{ message: AdminSupportMessage | null; error: string | null }> {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 2000) {
    return { message: null, error: 'Messages must be between 1 and 2,000 characters.' };
  }
  const { data, error } = await supabase
    .from('admin_support_messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed })
    .select('*')
    .single();
  return { message: (data as AdminSupportMessage | null) ?? null, error: error?.message ?? null };
}

export async function fetchSupportConversations(): Promise<{
  conversations: AdminSupportConversation[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('admin_support_conversations')
    .select('id, user_id, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) return { conversations: [], error: error.message };

  const rows = data ?? [];
  if (rows.length === 0) return { conversations: [], error: null };
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, campus_email')
    .in('id', userIds);
  if (profileError) return { conversations: [], error: profileError.message };
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return {
    conversations: rows.map((row) => {
      const profile = byId.get(row.user_id);
      return {
        ...row,
        user_name: profile?.full_name || 'ReFound user',
        campus_email: profile?.campus_email ?? null,
      };
    }),
    error: null,
  };
}

export function watchSupportConversation(
  conversationId: string,
  onChange: () => void
): RealtimeChannel {
  return supabase
    .channel(`support-conversation-${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'admin_support_messages', filter: `conversation_id=eq.${conversationId}` },
      onChange
    )
    .subscribe();
}

export function watchAdminSupportInbox(onChange: () => void): RealtimeChannel {
  return supabase
    .channel('admin-support-inbox')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_support_conversations' }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_support_messages' }, onChange)
    .subscribe();
}

export async function removeSupportChatChannel(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}
