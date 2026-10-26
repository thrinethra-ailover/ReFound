import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { supabase } from '../../lib/supabase';

const OPTIONS = [
  ['matches', 'Potential matches'],
  ['verification', 'Ownership verification'],
  ['messages', 'Messages'],
  ['recovery', 'Handoffs and recovery updates'],
  ['savedSearches', 'Saved search alerts'],
  ['proximity', 'Nearby item alerts'],
] as const;
type PreferenceKey = (typeof OPTIONS)[number][0];
type Preferences = Record<PreferenceKey, boolean>;

const DEFAULTS: Preferences = { matches: true, verification: true, messages: true, recovery: true, savedSearches: true, proximity: true };

export function NotificationPreferences() {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState<PreferenceKey | null>(null);
  const saved = { ...DEFAULTS, ...(profile?.notification_preferences ?? {}) } as Preferences;

  const toggle = async (key: PreferenceKey) => {
    if (!user || saving) return;
    const next = { ...saved, [key]: !saved[key] };
    setSaving(key);
    const { error } = await supabase.from('profiles').update({ notification_preferences: next, updated_at: new Date().toISOString() }).eq('id', user.id);
    setSaving(null);
    if (error) { showToast(error.message, 'error'); return; }
    await refreshProfile();
  };

  return (
    <section className="rounded-card border border-border bg-white p-6 shadow-card sm:p-8">
      <h2 className="font-display text-lg font-semibold text-ink">Notification preferences</h2>
      <p className="mt-1 text-sm text-slate">Choose which updates can reach you by email or push. Your in-app notification center keeps all updates.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm text-ink">
            <input type="checkbox" checked={saved[key]} disabled={saving !== null} onChange={() => void toggle(key)} className="h-4 w-4 accent-signal" />
            <span>{label}</span>
            {saving === key && <span className="ml-auto text-xs text-slate">Saving…</span>}
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate">Email and push must also be enabled in their settings below. Critical in-app messages are not disabled by these controls.</p>
    </section>
  );
}
