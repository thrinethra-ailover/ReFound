// Types for the deterministic spatio-temporal matching engine.
// Pure, framework-free — no Supabase or React imports here so the engine
// stays trivially unit-testable and portable (e.g. to a future Edge Function).

export type MatchConfidence = 'STRONG' | 'POSSIBLE' | 'LOW';

/** Minimal shape of an item the engine needs. Intentionally excludes any
 *  private/hidden verification data — the engine only ever sees public,
 *  non-sensitive report fields. */
export interface MatchCandidate {
  id: string;
  reporterId: string;
  category: string;
  title: string;
  description: string | null;
  color: string | null;
  itemDatetime: string; // ISO timestamp
  latitude: number | null;
  longitude: number | null;
}

export interface ScoreBreakdown {
  category: number; // 0-100
  keyword: number; // 0-100
  colorAttributes: number; // 0-100
  location: number; // 0-100
  time: number; // 0-100
}

export interface MatchResult {
  candidateItemId: string;
  score: number; // 0-100, rounded
  confidence: MatchConfidence;
  reasons: string[];
  distanceMeters: number | null;
  timeDifferenceMinutes: number | null;
  breakdown: ScoreBreakdown;
}

/** Transparent scoring weights. Must sum to 1. */
export const MATCH_WEIGHTS = {
  category: 0.2,
  keyword: 0.2,
  colorAttributes: 0.1,
  location: 0.25,
  time: 0.25,
} as const;

export const MATCH_THRESHOLDS = {
  strong: 80,
  possible: 60,
} as const;
