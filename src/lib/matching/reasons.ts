import { sharedKeywords } from './scoring';
import type { ScoreBreakdown } from './types';

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)}m apart`;
  return `${(distanceMeters / 1000).toFixed(1)}km apart`;
}

function formatTimeDifference(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `reported ${Math.round(abs)} minutes apart`;
  if (abs < 24 * 60) {
    const hours = Math.round(abs / 60);
    return `reported ${hours} hour${hours === 1 ? '' : 's'} apart`;
  }
  const days = Math.round(abs / (24 * 60));
  return `reported ${days} day${days === 1 ? '' : 's'} apart`;
}

export interface ReasonInput {
  breakdown: ScoreBreakdown;
  categoryA: string;
  categoryB: string;
  colorA: string | null;
  colorB: string | null;
  textA: string; // title + description
  textB: string;
  distanceMeters: number | null;
  timeDifferenceMinutes: number | null;
}

/** Builds the explainable, human-readable reasons list for a match score. */
export function buildMatchReasons(input: ReasonInput): string[] {
  const reasons: string[] = [];

  if (input.breakdown.category === 100) {
    reasons.push(`Same category: ${input.categoryA}`);
  }

  if (input.breakdown.keyword > 0) {
    const shared = sharedKeywords(input.textA, input.textB).slice(0, 4);
    if (shared.length > 0) {
      reasons.push(`Descriptions share keywords: ${shared.join(', ')}`);
    }
  }

  if (input.colorA && input.colorB && input.breakdown.colorAttributes === 100) {
    reasons.push(`Same color: ${input.colorA}`);
  }

  if (input.distanceMeters !== null) {
    reasons.push(formatDistance(input.distanceMeters));
  } else {
    reasons.push('Location not shared by one or both reports');
  }

  if (input.timeDifferenceMinutes !== null) {
    reasons.push(formatTimeDifference(input.timeDifferenceMinutes));
  }

  return reasons;
}
