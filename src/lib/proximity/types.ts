// Types for the deterministic proximity engine.
// Pure, framework-free — mirrors the style of the matching engine so the
// same testing/portability guarantees apply.

export type ProximityRadius = 50 | 100 | 250 | 500;

export const PROXIMITY_RADII: ProximityRadius[] = [50, 100, 250, 500];
export const DEFAULT_PROXIMITY_RADIUS: ProximityRadius = 100;

/** Minimal shape of an unresolved LOST item needed for proximity checks.
 *  Intentionally excludes title, description, and reporter identity — the
 *  proximity engine only ever needs category + coordinates. */
export interface ProximityCandidate {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
}

export interface ProximityHit {
  itemId: string;
  category: string;
  distanceMeters: number;
}
