import { supabase } from './supabase';
import { buildProximityAlertMessage, type ProximityCandidate, type ProximityRadius } from './proximity';

export async function updateProximitySettings(
  userId: string,
  enabled: boolean,
  radiusMeters: ProximityRadius
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({
      proximity_assist_enabled: enabled,
      proximity_radius_meters: radiusMeters,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

/**
 * Records that a proximity alert is about to be shown, subject to the
 * server-enforced 24h cooldown. Returns `sent: true` only if the cooldown
 * had elapsed and a new log row was created — the caller should show the
 * alert exactly when this is true, and stay silent otherwise. Also echoes
 * the alert into the general notifications table (Notification Center +
 * push/email dispatch), scoped strictly to the current user's own row.
 */
export async function recordProximityAlert(
  itemId: string,
  distanceMeters: number,
  category: string,
  userId: string
): Promise<{ sent: boolean; error: string | null }> {
  const { data, error } = await supabase.rpc('record_proximity_alert', {
    p_item_id: itemId,
    p_distance_meters: distanceMeters,
  });
  if (error) return { sent: false, error: error.message };

  const sent = Boolean(data);
  if (sent) {
    const message = buildProximityAlertMessage(category);
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'PROXIMITY_ALERT',
      title: message.title,
      body: message.body,
      related_match_id: null,
    });
  }

  return { sent, error: null };
}

/**
 * Fetches unresolved LOST items that opted into location sharing, excluding
 * the current user's own reports. Only the minimal fields the proximity
 * engine needs are selected — never title, description, or reporter
 * identity.
 */
export async function fetchLostItemsForProximityCheck(
  excludeReporterId: string
): Promise<{ candidates: ProximityCandidate[]; error: string | null }> {
  const { data, error } = await supabase
    .from('items')
    .select('id, category, latitude, longitude, reporter_id')
    .eq('report_type', 'LOST')
    .eq('status', 'ACTIVE')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) return { candidates: [], error: error.message };

  const candidates = (data ?? [])
    .filter((row) => row.reporter_id !== excludeReporterId)
    .map((row) => ({
      id: row.id as string,
      category: row.category as string,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
    }));

  return { candidates, error: null };
}
