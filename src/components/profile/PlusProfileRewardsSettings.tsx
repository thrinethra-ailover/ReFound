import { useEffect, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { supabase } from '../../lib/supabase';
import type { Profile, ProfileBanner, ReFoundPlusBadgeStyle } from '../../types/database';
import { ReFoundAdminBadge } from '../admin/ReFoundAdminBadge';

const BANNERS: { value: ProfileBanner; label: string }[] = [
  { value: 'AURORA', label: 'Aurora' },
  { value: 'CIRCUIT', label: 'Circuit glow' },
  { value: 'NIGHT_SKY', label: 'Night sky' },
  { value: 'CRYSTAL', label: 'Crystal bloom' },
  { value: 'EMBER', label: 'Emberlight' },
];
const BADGES: { value: ReFoundPlusBadgeStyle; label: string }[] = [
  { value: 'CLASSIC', label: 'Golden classic' },
  { value: 'PRISM', label: 'Prism' },
  { value: 'EMBER', label: 'Ember' },
  { value: 'OCEAN', label: 'Ocean' },
  { value: 'EMERALD', label: 'Emerald' },
];

export function PlusProfileRewardsSettings({
  userId, profile, isAdmin, plusActive, onSaved,
}: {
  userId: string;
  profile: Profile | null;
  isAdmin: boolean;
  plusActive: boolean;
  onSaved: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [banner, setBanner] = useState<ProfileBanner>(profile?.profile_banner ?? 'AURORA');
  const [badgeStyle, setBadgeStyle] = useState<ReFoundPlusBadgeStyle>(profile?.supporter_badge_style ?? 'CLASSIC');
  const [recognize, setRecognize] = useState(profile?.supporter_recognition_enabled ?? false);
  const [displayName, setDisplayName] = useState(profile?.supporter_display_name ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBanner(profile?.profile_banner ?? 'AURORA');
    setBadgeStyle(profile?.supporter_badge_style ?? 'CLASSIC');
    setRecognize(profile?.supporter_recognition_enabled ?? false);
    setDisplayName(profile?.supporter_display_name ?? '');
  }, [profile]);

  const canCustomize = isAdmin || plusActive;
  const canManageRecognition = !isAdmin && (plusActive || recognize);
  if (!canCustomize && !canManageRecognition) return null;

  const saveAdminRecognition = async () => {
    if (recognize && !displayName.trim()) {
      showToast('Choose the name you want shown on the recognition wall.', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      ...(plusActive ? { profile_banner: banner, supporter_badge_style: badgeStyle } : {}),
      supporter_recognition_enabled: recognize,
      supporter_display_name: recognize ? displayName.trim() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    await onSaved();
    showToast('Profile rewards saved.', 'success');
  };

  if (isAdmin) return <section className="flex flex-col gap-4 rounded-card border border-border bg-white p-6 shadow-card sm:p-8">
    <div>
      <h2 className="font-display text-lg font-semibold text-ink">Profile rewards</h2>
      <p className="mt-1 text-sm text-slate">Your Admin identity stays in place. You can still choose whether to be recognized for supporting ReFound+.</p>
    </div>
    <div className="flex items-center gap-4 rounded-xl border border-border bg-paper p-4">
      <ReFoundAdminBadge className="h-14 w-14 shrink-0" />
      <div>
        <p className="font-semibold text-ink">ReFound Admin</p>
        <p className="mt-1 text-sm leading-5 text-slate">Your Admin identity stays in place. ReFound+ lets you customize its banner treatment and badge accent without changing its design or title.</p>
      </div>
    </div>
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
      Admin banner treatment
      <select value={banner} disabled={!plusActive} onChange={(event) => setBanner(event.target.value as ProfileBanner)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink disabled:opacity-60">
        {BANNERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span className="text-xs font-normal text-slate">Changes the color treatment behind your ReFound Admin title.</span>
    </label>
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
      Admin badge accent
      <select value={badgeStyle} disabled={!plusActive} onChange={(event) => setBadgeStyle(event.target.value as ReFoundPlusBadgeStyle)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink disabled:opacity-60">
        {BADGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span className="text-xs font-normal text-slate">Changes the colors of your Admin badge while keeping its Admin design.</span>
    </label>
    <div className="rounded-xl border border-border p-4">
      <label className="flex items-start gap-3 text-sm font-semibold text-ink">
        <input type="checkbox" checked={recognize} disabled={!plusActive && !recognize} onChange={(event) => setRecognize(event.target.checked)} className="mt-0.5 accent-amber-500 disabled:opacity-50" />
        Recognize me on the public wall
      </label>
      <p className="mt-1 pl-7 text-xs leading-5 text-slate">Your email and reports remain private. You can opt out whenever you like.</p>
      {recognize && <label className="mt-3 block text-sm font-medium text-ink">Public display name
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 40))} disabled={!plusActive} maxLength={40} required className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink disabled:opacity-60" placeholder="Name to show publicly" />
      </label>}
    </div>
    <button type="button" onClick={() => void saveAdminRecognition()} disabled={saving} className="self-start rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-signal-dark disabled:opacity-60">{saving ? 'Saving…' : 'Save profile rewards'}</button>
  </section>;

  const save = async () => {
    if (recognize && !isAdmin && !displayName.trim()) {
      showToast('Choose the name you want shown on the supporter wall.', 'error');
      return;
    }
    setSaving(true);
    const update = {
      ...(canCustomize ? { profile_banner: banner, supporter_badge_style: badgeStyle } : {}),
      ...(!isAdmin ? {
        supporter_recognition_enabled: recognize,
        supporter_display_name: displayName.trim() || null,
      } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('profiles').update(update).eq('id', userId);
    setSaving(false);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    await onSaved();
    showToast('ReFound+ profile rewards saved.', 'success');
  };

  return <section className="flex flex-col gap-5 rounded-card border border-border bg-white p-6 shadow-card sm:p-8">
    <div>
      <h2 className="font-display text-lg font-semibold text-ink">Profile rewards</h2>
      <p className="mt-1 text-sm text-slate">Personalize your ReFound+ profile and choose whether your supporter badge appears on the public thank-you wall.</p>
    </div>
    {canCustomize && <>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Profile banner
        <select value={banner} onChange={(event) => setBanner(event.target.value as ProfileBanner)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink">
          {BANNERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <span className="text-xs font-normal text-slate">Shown behind your large badge on your profile.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Supporter badge style
        <select value={badgeStyle} onChange={(event) => setBadgeStyle(event.target.value as ReFoundPlusBadgeStyle)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink">
          {BADGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <span className="text-xs font-normal text-slate">Changes your ReFound+ crest wherever it appears. The app creator keeps The Creator insignia.</span>
      </label>
    </>}
    {canManageRecognition && <div className="rounded-xl border border-border p-4">
      <label className="flex items-start gap-3 text-sm font-semibold text-ink">
        <input type="checkbox" checked={recognize} onChange={(event) => setRecognize(event.target.checked)} className="mt-0.5 accent-amber-500" />
        Show me on the public supporter wall
      </label>
      <p className="mt-1 pl-7 text-xs leading-5 text-slate">Only the display name and supporter level are shown. Your email, reports, and account details stay private. You can opt out whenever you like.</p>
      {recognize && <label className="mt-3 block text-sm font-medium text-ink">Public display name
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 40))} maxLength={40} required className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink" placeholder="Name to show publicly" />
      </label>}
    </div>}
    <button type="button" onClick={() => void save()} disabled={saving} className="self-start rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-signal-dark disabled:opacity-60">{saving ? 'Saving…' : 'Save profile rewards'}</button>
  </section>;
}
