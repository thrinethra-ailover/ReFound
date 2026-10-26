import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useGeolocation } from './useGeolocation';
import { findNearbyLostItems, type ProximityHit } from '../lib/proximity';
import { fetchLostItemsForProximityCheck, recordProximityAlert } from '../lib/proximityService';

export interface ActiveProximityAlert extends ProximityHit {
  key: number;
}

let alertKeyCounter = 0;

/**
 * Orchestrates Proximity Assist end-to-end for the logged-in user:
 *  - only watches location if the user has opted in (profile setting)
 *  - if permission was already granted in a previous session, silently
 *    resumes (no new prompt) via the Permissions API when available
 *  - otherwise requires an explicit `requestPermission()` call — this hook
 *    never triggers the browser's permission prompt on its own
 *  - runs the deterministic proximity engine against unresolved LOST items
 *  - respects the server-side 24h cooldown before surfacing any alert
 */
export function useProximityAssist() {
  const { user, profile } = useAuth();
  const geo = useGeolocation(true);
  const [alerts, setAlerts] = useState<ActiveProximityAlert[]>([]);
  const seenThisSessionRef = useRef<Set<string>>(new Set());
  const autoResumeAttemptedRef = useRef(false);

  const enabled = Boolean(profile?.proximity_assist_enabled);
  const radius = profile?.proximity_radius_meters ?? 100;

  // If the user already granted geolocation permission in a past session,
  // resume watching without a new prompt. If permission is still in the
  // "prompt" state, do nothing — an explicit click is required.
  useEffect(() => {
    if (!enabled || autoResumeAttemptedRef.current) return;
    autoResumeAttemptedRef.current = true;

    if (!('permissions' in navigator)) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        if (result.state === 'granted') geo.request();
      })
      .catch(() => {
        /* Permissions API unsupported for this query in some browsers — ignore. */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      geo.clear();
      seenThisSessionRef.current.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!user || !enabled || !geo.position) return;
    let cancelled = false;

    (async () => {
      const { candidates } = await fetchLostItemsForProximityCheck(user.id);
      if (cancelled) return;

      const hits = findNearbyLostItems(
        { latitude: geo.position!.latitude, longitude: geo.position!.longitude },
        candidates,
        radius
      );

      for (const hit of hits) {
        if (seenThisSessionRef.current.has(hit.itemId)) continue;
        seenThisSessionRef.current.add(hit.itemId);

        const { sent } = await recordProximityAlert(hit.itemId, hit.distanceMeters, hit.category, user.id);
        if (sent && !cancelled) {
          alertKeyCounter += 1;
          setAlerts((prev) => [...prev, { ...hit, key: alertKeyCounter }]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [geo.position, enabled, radius, user]);

  const dismissAlert = (key: number) => {
    setAlerts((prev) => prev.filter((a) => a.key !== key));
  };

  return {
    enabled,
    radius,
    geoStatus: geo.status,
    geoErrorMessage: geo.errorMessage,
    alerts,
    dismissAlert,
    requestPermission: geo.request,
  };
}
