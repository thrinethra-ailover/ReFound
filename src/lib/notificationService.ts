import { supabase } from './supabase';
import type { AppNotification } from '../types/database';

export async function fetchNotifications(): Promise<{
  notifications: AppNotification[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return { notifications: [], error: error.message };
  return { notifications: (data ?? []) as AppNotification[], error: null };
}

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function markAllNotificationsRead(ids: string[]): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', ids);
  return { error: error?.message ?? null };
}
