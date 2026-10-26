import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { isFirebaseConfigured, onForegroundPushMessage } from '../../lib/firebase';

/** No UI of its own — just bridges foreground FCM messages into the toast system. */
export function PushMessageListener() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (!user || !profile?.push_notifications_enabled || !isFirebaseConfigured()) return;

    const unsubscribe = onForegroundPushMessage((title, body) => {
      showToast(`${title}: ${body}`, 'info');
    });

    return unsubscribe;
  }, [user, profile?.push_notifications_enabled, showToast]);

  return null;
}
