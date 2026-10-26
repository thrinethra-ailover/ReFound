import { useEffect, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import type { Profile } from '../../types/database';
import {
  DEFAULT_PLUS_PERSONALIZATION,
  readPlusPersonalization,
  savePlusPersonalization,
  type PlusPersonalization,
} from '../../lib/plusPersonalization';

type ProfileAccent = NonNullable<Profile['profile_accent']>;

export function PlusPersonalizationSettings({
  userId,
  profileAccent,
  onProfileAccentChange,
  onSaveProfileAccent,
  canEditAccent,
}: {
  userId: string;
  profileAccent: ProfileAccent;
  onProfileAccentChange: (accent: ProfileAccent) => void;
  onSaveProfileAccent: (accent: ProfileAccent) => Promise<boolean>;
  canEditAccent: boolean;
}) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<PlusPersonalization>(DEFAULT_PLUS_PERSONALIZATION);
  const [saving, setSaving] = useState(false);

  useEffect(() => setSettings(readPlusPersonalization(userId)), [userId]);

  const save = async () => {
    setSaving(true);
    const accentSaved = !canEditAccent || await onSaveProfileAccent(profileAccent);
    savePlusPersonalization(userId, settings);
    setSaving(false);
    if (accentSaved) showToast('Personalization saved.', 'success');
  };

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-white p-6 shadow-card sm:p-8">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">ReFound+ ambience</h2>
        <p className="mt-1 text-sm text-slate">Choose a subtle background atmosphere and a desktop cursor style. These effects are saved on this device.</p>
      </div>
      {canEditAccent && <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Profile accent
        <select value={profileAccent ?? 'DEFAULT'} onChange={(event) => onProfileAccentChange(event.target.value as ProfileAccent)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink">
          <option value="DEFAULT">Default</option><option value="TEAL">Teal</option><option value="GREEN">Green</option><option value="LIME">Lime</option><option value="CYAN">Cyan</option><option value="BLUE">Blue</option><option value="INDIGO">Indigo</option><option value="VIOLET">Violet</option><option value="PURPLE">Purple</option><option value="PINK">Pink</option><option value="ROSE">Rose</option><option value="RED">Red</option><option value="ORANGE">Orange</option><option value="AMBER">Amber</option><option value="YELLOW">Yellow</option>
        </select>
        <span className="text-xs font-normal text-slate">Colors buttons, active navigation, focused controls, and the landing-page pin.</span>
      </label>}
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Ambient effect
        <select value={settings.ambient} onChange={(event) => setSettings({ ...settings, ambient: event.target.value as PlusPersonalization['ambient'] })} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink">
          <option value="OFF">Off</option>
          <option value="AURORA">Slow aurora</option>
          <option value="STARDUST">Drifting stardust</option>
          <option value="CIRCUIT">Circuit traces</option>
          <option value="EMBER">Ember field</option>
          <option value="PRISM">Prism haze</option>
          <option value="NEON_GRID">Neon grid</option>
          <option value="DEEP_SPACE">Deep space</option>
          <option value="SOLAR_FLARE">Solar flare</option>
          <option value="PETALS">Floating petals</option>
          <option value="ELECTRIC">Electric pulse</option>
        </select>
        <span className="text-xs font-normal text-slate">Decorative only, kept behind app content, and automatically still when reduced motion is enabled.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Custom cursor <span className="text-xs font-normal text-slate">Desktop pointers only</span>
        <select value={settings.cursor} onChange={(event) => setSettings({ ...settings, cursor: event.target.value as PlusPersonalization['cursor'] })} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink">
          <option value="OFF">System cursor</option>
          <option value="HALO">Accent halo</option>
          <option value="GLOW">Soft glow</option>
          <option value="ORBIT">Orbiting sparks</option>
          <option value="SPARK">Prism spark</option>
          <option value="TRAIL">Trailing comet</option>
          <option value="DIAMOND">Rotating diamond</option>
          <option value="PULSE">Pulse rings</option>
          <option value="CONSTELLATION">Constellation</option>
          <option value="CROSSHAIR">Neon crosshair</option>
          <option value="COMET">Comet flare</option>
        </select>
      </label>
      <button type="button" onClick={() => void save()} disabled={saving} className="self-start rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-signal-dark active:translate-y-0 disabled:cursor-wait disabled:opacity-60">
        {saving ? 'Saving…' : 'Save personalization'}
      </button>
    </section>
  );
}
