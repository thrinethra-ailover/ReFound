import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useToast } from '../../hooks/useToast';
import { updateProximitySettings } from '../../lib/proximityService';
import { PROXIMITY_RADII, type ProximityRadius } from '../../lib/proximity';
import { Button } from '../ui/Button';

const STATUS_COPY: Record<string, string> = {
  requesting: 'Waiting for your browser\u2019s location prompt\u2026',
  denied:
    'Location permission was denied in your browser. Proximity Assist stays off until you allow location access for this site.',
  unavailable: 'Your location could not be determined. Try again once you have a better signal.',
  timeout: 'Locating you took too long. Please try again.',
  unsupported: 'Your browser does not support geolocation, so Proximity Assist isn\u2019t available here.',
  error: 'Something went wrong getting your location.',
};

export function ProximityAssistSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const geo = useGeolocation(false);
  const [saving, setSaving] = useState(false);
  const enablingRef = useRef(false);

  const enabled = Boolean(profile?.proximity_assist_enabled);
  const radius = (profile?.proximity_radius_meters ?? 100) as ProximityRadius;

  const handleEnable = () => {
    // Explicit opt-in action — this is the ONLY place the browser's location
    // prompt is ever triggered.
    enablingRef.current = true;
    geo.request();
  };

  // Once the browser grants a fresh location fix in response to the user's
  // explicit click, persist the enabled preference.
  useEffect(() => {
    if (geo.status !== 'granted' || !enablingRef.current || !user) return;
    enablingRef.current = false;

    let cancelled = false;
    setSaving(true);
    updateProximitySettings(user.id, true, radius).then(async ({ error }) => {
      if (cancelled) return;
      setSaving(false);
      if (error) {
        showToast(error, 'error');
        return;
      }
      await refreshProfile();
      showToast('Proximity Assist enabled.', 'success');
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.status]);

  const handleDisable = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await updateProximitySettings(user.id, false, radius);
    setSaving(false);
    if (error) {
      showToast(error, 'error');
      return;
    }
    geo.clear();
    await refreshProfile();
    showToast('Proximity Assist disabled.', 'success');
  };

  const handleRadiusChange = async (nextRadius: ProximityRadius) => {
    if (!user) return;
    setSaving(true);
    const { error } = await updateProximitySettings(user.id, true, nextRadius);
    setSaving(false);
    if (error) {
      showToast(error, 'error');
      return;
    }
    await refreshProfile();
  };

  return (
    <div className="rounded-card border border-border bg-white p-6 shadow-card sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Proximity Assist</p>
          <p className="mt-1 text-sm text-slate">
            ReFound can use your approximate location while you are using the application to
            alert you about nearby unresolved lost items.
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

      {!enabled && (
        <div className="mt-4">
          <Button size="sm" onClick={handleEnable} loading={geo.status === 'requesting'}>
            Enable Proximity Assist
          </Button>
          {geo.status !== 'idle' && geo.status !== 'granted' && geo.errorMessage && (
            <p className="mt-2 text-xs text-coral-dark">{STATUS_COPY[geo.status] ?? geo.errorMessage}</p>
          )}
        </div>
      )}

      {enabled && (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Alert radius</p>
            <p className="text-xs text-slate">How close you need to be to an unresolved lost item.</p>
            <div className="mt-2 flex gap-2">
              {PROXIMITY_RADII.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleRadiusChange(option)}
                  disabled={saving}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    radius === option
                      ? 'border-signal bg-signal/10 text-signal-dark'
                      : 'border-border bg-white text-ink hover:bg-black/[0.02]'
                  }`}
                >
                  {option}m
                </button>
              ))}
            </div>
          </div>
          <div>
            <Button size="sm" variant="ghost" onClick={handleDisable} loading={saving}>
              Disable Proximity Assist
            </Button>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-light">
        We never store a continuous history of your location — only the minimum needed to check
        proximity in the moment, and a rounded distance is kept for 24 hours to avoid repeat
        alerts about the same item.
      </p>
    </div>
  );
}
