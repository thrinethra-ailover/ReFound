import { describe, expect, it } from 'vitest';
import {
  computeMatch,
  excludeAlreadyMatched,
  filterVisibleMatches,
  rankMatches,
} from '../engine';
import type { MatchCandidate } from '../types';

function lostItem(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    id: 'lost-1',
    reporterId: 'user-owner',
    category: 'Bags & Backpacks',
    title: 'Black North Face backpack',
    description: 'Has a laptop sleeve and a small keychain on the zipper.',
    color: 'Black',
    itemDatetime: '2026-03-10T14:00:00Z',
    latitude: 37.7749,
    longitude: -122.4194,
    ...overrides,
  };
}

function foundItem(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    id: 'found-1',
    reporterId: 'user-finder',
    category: 'Bags & Backpacks',
    title: 'Black backpack found near library',
    description: 'North Face backpack with a laptop sleeve inside.',
    color: 'Black',
    itemDatetime: '2026-03-10T14:35:00Z',
    latitude: 37.7755,
    longitude: -122.4201,
    ...overrides,
  };
}

describe('computeMatch (explainable weighted scoring)', () => {
  it('produces a strong match for near-identical, close, contemporaneous reports', () => {
    const result = computeMatch(lostItem(), foundItem());
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.confidence).toBe('STRONG');
    expect(result.candidateItemId).toBe('found-1');
  });

  it('includes distance and time difference in the result', () => {
    const result = computeMatch(lostItem(), foundItem());
    expect(result.distanceMeters).not.toBeNull();
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.timeDifferenceMinutes).toBe(-35);
  });

  it('produces human-readable reasons explaining the score', () => {
    const result = computeMatch(lostItem(), foundItem());
    expect(result.reasons.some((r) => r.includes('Same category'))).toBe(true);
    expect(result.reasons.some((r) => r.includes('apart'))).toBe(true);
  });

  it('produces a low-confidence result for unrelated reports', () => {
    const result = computeMatch(
      lostItem(),
      foundItem({
        category: 'Electronics',
        title: 'Silver wired earbuds',
        description: 'Found near the gym entrance.',
        color: 'Silver',
        itemDatetime: '2026-01-01T00:00:00Z',
        latitude: 40.7128,
        longitude: -74.006,
      })
    );
    expect(result.score).toBeLessThan(60);
    expect(result.confidence).toBe('LOW');
  });

  it('does not penalize missing location data', () => {
    const result = computeMatch(
      lostItem({ latitude: null, longitude: null }),
      foundItem({ latitude: null, longitude: null })
    );
    expect(result.distanceMeters).toBeNull();
    expect(result.breakdown.location).toBe(50);
  });

  it('is deterministic: identical inputs always produce identical output', () => {
    const a = computeMatch(lostItem(), foundItem());
    const b = computeMatch(lostItem(), foundItem());
    expect(a).toEqual(b);
  });
});

describe('rankMatches', () => {
  it('sorts candidates from highest to lowest score', () => {
    const goodMatch = foundItem({ id: 'found-good' });
    const badMatch = foundItem({
      id: 'found-bad',
      category: 'Electronics',
      title: 'Phone charger',
      description: 'A random charger.',
      color: 'White',
      itemDatetime: '2020-01-01T00:00:00Z',
      latitude: -33.8688,
      longitude: 151.2093,
    });

    const results = rankMatches(lostItem(), [badMatch, goodMatch]);
    expect(results[0].candidateItemId).toBe('found-good');
    expect(results[1].candidateItemId).toBe('found-bad');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('excludes candidates reported by the same user as the source', () => {
    const ownFound = foundItem({ id: 'found-own', reporterId: 'user-owner' });
    const results = rankMatches(lostItem(), [ownFound]);
    expect(results).toHaveLength(0);
  });
});

describe('filterVisibleMatches (threshold gating)', () => {
  it('only keeps STRONG and POSSIBLE matches (score >= 60)', () => {
    const results = rankMatches(lostItem(), [
      foundItem({ id: 'strong' }),
      foundItem({
        id: 'low',
        category: 'Electronics',
        title: 'Charger',
        description: 'Random item',
        color: 'White',
        itemDatetime: '2020-01-01T00:00:00Z',
        latitude: -33.8688,
        longitude: 151.2093,
      }),
    ]);
    const visible = filterVisibleMatches(results);
    expect(visible.every((r) => r.score >= 60)).toBe(true);
    expect(visible.some((r) => r.candidateItemId === 'low')).toBe(false);
  });
});

describe('excludeAlreadyMatched (duplicate match prevention)', () => {
  it('removes candidates that already have a recorded match', () => {
    const candidates = [foundItem({ id: 'found-1' }), foundItem({ id: 'found-2' })];
    const remaining = excludeAlreadyMatched(candidates, ['found-1']);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('found-2');
  });

  it('returns all candidates when nothing is already matched', () => {
    const candidates = [foundItem({ id: 'found-1' }), foundItem({ id: 'found-2' })];
    const remaining = excludeAlreadyMatched(candidates, []);
    expect(remaining).toHaveLength(2);
  });

  it('returns an empty list when everything is already matched', () => {
    const candidates = [foundItem({ id: 'found-1' })];
    const remaining = excludeAlreadyMatched(candidates, ['found-1']);
    expect(remaining).toHaveLength(0);
  });
});
