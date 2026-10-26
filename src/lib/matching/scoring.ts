import { MATCH_THRESHOLDS, MATCH_WEIGHTS, type MatchConfidence, type ScoreBreakdown } from './types';

// ============================================================================
// Distance
// ============================================================================

const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance between two coordinates, in meters. */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

// ============================================================================
// Component scores (each 0-100)
// ============================================================================

/** Exact-match category score. Categories come from a fixed, finite list. */
export function scoreCategory(categoryA: string, categoryB: string): number {
  return normalize(categoryA) === normalize(categoryB) ? 100 : 0;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'with', 'of', 'in', 'on', 'at', 'my', 'is',
  'was', 'to', 'for', 'this', 'that', 'it', 'has', 'have', 'had', 'i', 'me',
  'near', 'by', 'from', 'be', 'been',
]);

/** Tokenizes free text into a lowercase, stopword-filtered keyword set. */
export function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
  return new Set(words);
}

/**
 * Keyword overlap between two pieces of text using the Sørensen–Dice
 * coefficient: 2*|A∩B| / (|A|+|B|), scaled to 0-100.
 */
export function scoreKeywords(textA: string, textB: string): number {
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }
  if (intersection === 0) return 0;

  const dice = (2 * intersection) / (setA.size + setB.size);
  return Math.round(dice * 100);
}

export function sharedKeywords(textA: string, textB: string): string[] {
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  return [...setA].filter((word) => setB.has(word));
}

/**
 * Color match score. Unknown/missing color on either side is treated as
 * neutral (50) rather than penalized, since color is optional at report time.
 */
export function scoreColor(colorA: string | null, colorB: string | null): number {
  if (!colorA || !colorB) return 50;
  return normalize(colorA) === normalize(colorB) ? 100 : 0;
}

const MAX_MATCH_DISTANCE_METERS = 1500;

/**
 * Location proximity score: 100 at 0m, decaying linearly to 0 at
 * MAX_MATCH_DISTANCE_METERS. Missing coordinates on either side (the
 * reporter didn't opt in to location sharing) score neutral (50) rather
 * than being penalized.
 */
export function scoreLocation(distanceMeters: number | null): number {
  if (distanceMeters === null) return 50;
  if (distanceMeters <= 0) return 100;
  if (distanceMeters >= MAX_MATCH_DISTANCE_METERS) return 0;
  return Math.round(100 * (1 - distanceMeters / MAX_MATCH_DISTANCE_METERS));
}

const MAX_MATCH_TIME_MINUTES = 3 * 24 * 60; // 3 days

/**
 * Temporal compatibility score: 100 at 0 minutes apart, decaying linearly
 * to 0 at MAX_MATCH_TIME_MINUTES apart (in either direction — a found
 * report can reasonably precede or follow the moment something was lost).
 */
export function scoreTime(minutesDifference: number | null): number {
  if (minutesDifference === null) return 50;
  const abs = Math.abs(minutesDifference);
  if (abs >= MAX_MATCH_TIME_MINUTES) return 0;
  return Math.round(100 * (1 - abs / MAX_MATCH_TIME_MINUTES));
}

// ============================================================================
// Weighted total + classification
// ============================================================================

export function computeWeightedScore(breakdown: ScoreBreakdown): number {
  const raw =
    breakdown.category * MATCH_WEIGHTS.category +
    breakdown.keyword * MATCH_WEIGHTS.keyword +
    breakdown.colorAttributes * MATCH_WEIGHTS.colorAttributes +
    breakdown.location * MATCH_WEIGHTS.location +
    breakdown.time * MATCH_WEIGHTS.time;
  return Math.round(clamp(raw, 0, 100));
}

export function classifyConfidence(score: number): MatchConfidence {
  if (score >= MATCH_THRESHOLDS.strong) return 'STRONG';
  if (score >= MATCH_THRESHOLDS.possible) return 'POSSIBLE';
  return 'LOW';
}

// ============================================================================
// Helpers
// ============================================================================

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function minutesBetween(isoA: string, isoB: string): number {
  const diffMs = new Date(isoA).getTime() - new Date(isoB).getTime();
  return diffMs / 60000;
}

export { MAX_MATCH_DISTANCE_METERS, MAX_MATCH_TIME_MINUTES };
