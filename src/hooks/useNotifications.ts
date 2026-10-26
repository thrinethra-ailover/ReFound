import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../lib/notificationService';
import type { AppNotification } from '../types/database';

let nextNotificationsChannelId = 0;

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { notifications: data } = await fetchNotifications();
    setNotifications(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live-update the bell as new notifications arrive (e.g. a match found
  // while the user is browsing elsewhere in the app).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      // The header bell and NotificationsPage can be mounted at the same time.
      // Give each hook instance its own channel so Supabase doesn't return an
      // already-subscribed channel and reject the second .on() call.
      .channel(`notifications:${userId}:${++nextNotificationsChannelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as AppNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await markNotificationRead(id);
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsRead(unreadIds);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, loading, unreadCount, refresh, markRead, markAllRead };
}
