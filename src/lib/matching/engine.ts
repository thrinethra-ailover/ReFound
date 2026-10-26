import { buildMatchReasons } from './reasons';
import {
  classifyConfidence,
  computeWeightedScore,
  haversineDistanceMeters,
  minutesBetween,
  scoreCategory,
  scoreColor,
  scoreKeywords,
  scoreLocation,
  scoreTime,
} from './scoring';
import { MATCH_THRESHOLDS, type MatchCandidate, type MatchResult, type ScoreBreakdown } from './types';

function itemText(item: Pick<MatchCandidate, 'title' | 'description'>): string {
  return [item.title, item.description ?? ''].join(' ');
}

/**
 * Computes a single, fully explainable match result between a source report
 * and one candidate of the opposite type. Deterministic — no randomness, no
 * ML/LLM calls, same inputs always produce the same output.
 */
export function computeMatch(source: MatchCandidate, candidate: MatchCandidate): MatchResult {
  const distanceMeters =
    source.latitude !== null &&
    source.longitude !== null &&
    candidate.latitude !== null &&
    candidate.longitude !== null
      ? haversineDistanceMeters(source.latitude, source.longitude, candidate.latitude, candidate.longitude)
      : null;

  const timeDifferenceMinutes = minutesBetween(source.itemDatetime, candidate.itemDatetime);

  const breakdown: ScoreBreakdown = {
    category: scoreCategory(source.category, candidate.category),
    keyword: scoreKeywords(itemText(source), itemText(candidate)),
    colorAttributes: scoreColor(source.color, candidate.color),
    location: scoreLocation(distanceMeters),
    time: scoreTime(timeDifferenceMinutes),
  };

  const score = computeWeightedScore(breakdown);
  const confidence = classifyConfidence(score);

  const reasons = buildMatchReasons({
    breakdown,
    categoryA: source.category,
    categoryB: candidate.category,
    colorA: source.color,
    colorB: candidate.color,
    textA: itemText(source),
    textB: itemText(candidate),
    distanceMeters,
    timeDifferenceMinutes,
  });

  return {
    candidateItemId: candidate.id,
    score,
    confidence,
    reasons,
    distanceMeters,
    timeDifferenceMinutes,
    breakdown,
  };
}

/**
 * Ranks every candidate against a source report, best match first.
 * Candidates reported by the same user as the source are always excluded
 * (a person cannot match their own lost/found reports).
 */
export function rankMatches(source: MatchCandidate, candidates: MatchCandidate[]): MatchResult[] {
  return candidates
    .filter((candidate) => candidate.reporterId !== source.reporterId)
    .map((candidate) => computeMatch(source, candidate))
    .sort((a, b) => b.score - a.score);
}

/** Only STRONG/POSSIBLE matches should ever be surfaced to users. */
export function filterVisibleMatches(results: MatchResult[]): MatchResult[] {
  return results.filter((result) => result.score >= MATCH_THRESHOLDS.possible);
}

/**
 * Removes candidates that already have a recorded match against the source
 * item. Used before persisting new matches so the same (lost, found) pair is
 * never scored and written twice — the database also enforces this with a
 * unique constraint as a second line of defense.
 */
export function excludeAlreadyMatched(
  candidates: MatchCandidate[],
  alreadyMatchedCandidateIds: Iterable<string>
): MatchCandidate[] {
  const matched = new Set(alreadyMatchedCandidateIds);
  return candidates.filter((candidate) => !matched.has(candidate.id));
}

export * from './types';
export * from './scoring';
export * from './reasons';
