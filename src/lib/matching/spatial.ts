export type SpatialCompatibility = 'High' | 'Medium' | 'Low' | 'Unknown';

const HIGH_COMPATIBILITY_METERS = 150;
const MEDIUM_COMPATIBILITY_METERS = 500;

/**
 * Converts a raw distance into the human-readable compatibility label shown
 * alongside a match's explanation (Sprint 3, Feature 8). `null` means one or
 * both reports didn't share a location, so compatibility can't be assessed.
 */
export function classifySpatialCompatibility(distanceMeters: number | null): SpatialCompatibility {
  if (distanceMeters === null) return 'Unknown';
  if (distanceMeters <= HIGH_COMPATIBILITY_METERS) return 'High';
  if (distanceMeters <= MEDIUM_COMPATIBILITY_METERS) return 'Medium';
  return 'Low';
}

export { HIGH_COMPATIBILITY_METERS, MEDIUM_COMPATIBILITY_METERS };
