import { haversineDistanceMeters } from '../matching/scoring';
import type { ProximityCandidate, ProximityHit } from './types';

export interface UserPosition {
  latitude: number;
  longitude: number;
}

/**
 * Finds unresolved LOST items within `radiusMeters` of the user's current
 * position. Pure and deterministic — no network calls, no randomness.
 * Callers are responsible for excluding the user's own reports before
 * passing candidates in.
 */
export function findNearbyLostItems(
  userPosition: UserPosition,
  candidates: ProximityCandidate[],
  radiusMeters: number
): ProximityHit[] {
  return candidates
    .map((candidate) => ({
      itemId: candidate.id,
      category: candidate.category,
      distanceMeters: haversineDistanceMeters(
        userPosition.latitude,
        userPosition.longitude,
        candidate.latitude,
        candidate.longitude
      ),
    }))
    .filter((hit) => hit.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
