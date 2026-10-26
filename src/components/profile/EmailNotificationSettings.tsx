import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { supabase } from '../../lib/supabase';

export function EmailNotificationSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  const enabled = Boolean(profile?.email_notifications_enabled);

  const handleToggle = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ email_notifications_enabled: !enabled, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    await refreshProfile();
  };

  return (
    <div className="rounded-card border border-border bg-white p-6 shadow-card sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Email notifications</p>
          <p className="mt-1 text-sm text-slate">
            We&rsquo;ll only email you for the important stuff — potential matches, verification
            requests, and recovery confirmations. Never for every small update.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          role="switch"
          aria-checked={enabled}
          aria-label="Email notifications"
          className={`relative h-6 w-11 flex-none rounded-full transition-colors ${
            enabled ? 'bg-signal' : 'bg-border'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? 'left-0.5 translate-x-5' : 'left-0.5 translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
