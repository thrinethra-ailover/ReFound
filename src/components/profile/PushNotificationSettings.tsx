import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { checkPushSupport, requestPushToken, type PushSupportStatus } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';

const STATUS_COPY: Record<PushSupportStatus, string> = {
  unsupported: 'This browser does not support push notifications.',
  not_configured: 'Push notifications are not configured for this deployment yet.',
  supported: '',
};

export function PushNotificationSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [support, setSupport] = useState<PushSupportStatus>('not_configured');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    checkPushSupport().then(setSupport);
  }, []);

  const enabled = Boolean(profile?.push_notifications_enabled);

  const handleEnable = async () => {
    setBusy(true);
    const { token, error } = await requestPushToken();
    if (error || !token || !user) {
      setBusy(false);
      showToast(error ?? 'Could not enable push notifications.', 'error');
      return;
    }

    const [{ error: tokenError }, { error: profileError }] = await Promise.all([
      supabase.from('push_subscriptions').upsert({ user_id: user.id, fcm_token: token }, { onConflict: 'fcm_token' }),
      supabase
        .from('profiles')
        .update({ push_notifications_enabled: true, updated_at: new Date().toISOString() })
        .eq('id', user.id),
    ]);

    setBusy(false);
    if (tokenError || profileError) {
      showToast((tokenError ?? profileError)?.message ?? 'Something went wrong.', 'error');
      return;
    }
    await refreshProfile();
    showToast('Push notifications enabled.', 'success');
  };

  const handleDisable = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ push_notifications_enabled: false, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setBusy(false);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    await refreshProfile();
    showToast('Push notifications disabled.', 'success');
  };

  return (
    <div className="rounded-card border border-border bg-white p-6 shadow-card sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Push notifications</p>
          <p className="mt-1 text-sm text-slate">
            Get notified on this device for matches, verification requests, messages, and recovery
            updates — even when ReFound isn&rsquo;t open.
          </p>
        </div>
        <span
          className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${
            enabled ? 'bg-signal/10 text-signal-dark' : 'bg-slate/10 text-slate'
          }`}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {support !== 'supported' ? (
        <p className="mt-4 text-xs text-slate-light">{STATUS_COPY[support]}</p>
      ) : enabled ? (
        <div className="mt-4">
          <Button size="sm" variant="ghost" onClick={handleDisable} loading={busy}>
            Disable push notifications
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <Button size="sm" onClick={handleEnable} loading={busy}>
            Enable push notifications
          </Button>
        </div>
      )}
    </div>
  );
}
