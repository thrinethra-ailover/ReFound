import { describe, expect, it } from 'vitest';
import { findNearbyLostItems } from '../engine';
import { buildProximityAlertMessage } from '../message';
import { DEFAULT_PROXIMITY_RADIUS, PROXIMITY_RADII } from '../types';
import type { ProximityCandidate } from '../types';

const USER_POSITION = { latitude: 37.7749, longitude: -122.4194 };

function candidateAt(id: string, latOffsetDeg: number, lngOffsetDeg: number, category = 'Keys'): ProximityCandidate {
  return {
    id,
    category,
    latitude: USER_POSITION.latitude + latOffsetDeg,
    longitude: USER_POSITION.longitude + lngOffsetDeg,
  };
}

describe('findNearbyLostItems', () => {
  it('includes items within the radius', () => {
    // ~0.0003 deg latitude ≈ 33m
    const near = candidateAt('near', 0.0003, 0);
    const hits = findNearbyLostItems(USER_POSITION, [near], 100);
    expect(hits).toHaveLength(1);
    expect(hits[0].itemId).toBe('near');
    expect(hits[0].distanceMeters).toBeLessThan(100);
  });

  it('excludes items outside the radius', () => {
    // ~0.01 deg latitude ≈ 1113m — well beyond any configured radius
    const far = candidateAt('far', 0.01, 0);
    const hits = findNearbyLostItems(USER_POSITION, [far], 500);
    expect(hits).toHaveLength(0);
  });

  it('supports every configurable radius (50/100/250/500)', () => {
    expect(PROXIMITY_RADII).toEqual([50, 100, 250, 500]);
    expect(DEFAULT_PROXIMITY_RADIUS).toBe(100);

    const at40m = candidateAt('at40', 0.00036, 0); // ~40m
    const at300m = candidateAt('at300', 0.0027, 0); // ~300m

    expect(findNearbyLostItems(USER_POSITION, [at40m], 50).map((h) => h.itemId)).toContain('at40');
    expect(findNearbyLostItems(USER_POSITION, [at40m], 250).map((h) => h.itemId)).toContain('at40');
    expect(findNearbyLostItems(USER_POSITION, [at300m], 100).map((h) => h.itemId)).not.toContain('at300');
    expect(findNearbyLostItems(USER_POSITION, [at300m], 500).map((h) => h.itemId)).toContain('at300');
  });

  it('sorts results by ascending distance', () => {
    const nearer = candidateAt('nearer', 0.0002, 0);
    const farther = candidateAt('farther', 0.0008, 0);
    const hits = findNearbyLostItems(USER_POSITION, [farther, nearer], 200);
    expect(hits.map((h) => h.itemId)).toEqual(['nearer', 'farther']);
  });

  it('returns an empty array for no candidates', () => {
    expect(findNearbyLostItems(USER_POSITION, [], 100)).toEqual([]);
  });

  it('is inclusive at the exact radius boundary', () => {
    // Construct a candidate at (as close as practical to) exactly 100m.
    const dLat = 100 / 111_320;
    const boundary = candidateAt('boundary', dLat, 0);
    const hits = findNearbyLostItems(USER_POSITION, [boundary], Math.round(hitDistance(USER_POSITION, boundary)));
    expect(hits.map((h) => h.itemId)).toContain('boundary');
  });
});

function hitDistance(a: { latitude: number; longitude: number }, b: ProximityCandidate): number {
  const hits = findNearbyLostItems(a, [b], Number.MAX_SAFE_INTEGER);
  return hits[0].distanceMeters;
}

describe('buildProximityAlertMessage (anonymized alert copy)', () => {
  it('includes the category and the exact required phrasing', () => {
    const message = buildProximityAlertMessage('Keys');
    expect(message.title).toContain('Keep an eye out');
    expect(message.body).toContain('Keys');
    expect(message.body).toContain('lost around this area');
    expect(message.body).toContain('you can report it');
  });

  it('never includes any personally identifying fields', () => {
    const message = buildProximityAlertMessage('Electronics');
    const combined = `${message.title} ${message.body}`.toLowerCase();
    // Never leaks a name/email placeholder or coordinate-shaped output.
    expect(combined).not.toMatch(/@/);
    expect(combined).not.toMatch(/\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+/); // "lat,lng"-shaped string
  });
});
