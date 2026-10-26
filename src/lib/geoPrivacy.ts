// Deterministically nudges a coordinate by a small random-looking offset so
// a map marker approximates a location without pinpointing it exactly.
// Pure and seeded by item id: the same item always renders at the same
// fuzzed spot (stable across renders/reloads) without ever storing the
// offset anywhere. Distance/matching calculations must always use the real
// coordinates — fuzzing is strictly a display-time privacy measure.

const METERS_PER_DEGREE_LAT = 111_320;

/** Simple deterministic 32-bit hash (FNV-1a), used only to seed the offset. */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Two independent pseudo-random values in [0, 1), derived from one seed. */
function seededUnitPair(seed: string): [number, number] {
  const h1 = hashString(seed);
  const h2 = hashString(`${seed}:2`);
  return [h1 / 0xffffffff, h2 / 0xffffffff];
}

export interface FuzzedCoordinate {
  lat: number;
  lng: number;
}

/**
 * Returns a coordinate offset by up to `maxOffsetMeters` in a deterministic,
 * seed-stable direction and distance. Default max offset (60m) is small
 * enough to still look correct on a campus map while preventing the exact
 * reported spot from being pinpointed.
 */
export function fuzzCoordinate(
  lat: number,
  lng: number,
  seed: string,
  maxOffsetMeters = 60
): FuzzedCoordinate {
  const [angleUnit, radiusUnit] = seededUnitPair(seed);
  const angle = angleUnit * 2 * Math.PI;
  const distanceMeters = radiusUnit * maxOffsetMeters;

  const dLat = (distanceMeters * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  const dLng = metersPerDegreeLng === 0 ? 0 : (distanceMeters * Math.sin(angle)) / metersPerDegreeLng;

  return { lat: lat + dLat, lng: lng + dLng };
}
