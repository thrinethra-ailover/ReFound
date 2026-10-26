import { describe, expect, it } from 'vitest';
import { fuzzCoordinate } from '../geoPrivacy';
import { haversineDistanceMeters } from '../matching/scoring';

const LAT = 37.7749;
const LNG = -122.4194;

describe('fuzzCoordinate (privacy-safe map display)', () => {
  it('is deterministic: the same seed always produces the same offset', () => {
    const a = fuzzCoordinate(LAT, LNG, 'item-123');
    const b = fuzzCoordinate(LAT, LNG, 'item-123');
    expect(a).toEqual(b);
  });

  it('produces different offsets for different seeds', () => {
    const a = fuzzCoordinate(LAT, LNG, 'item-123');
    const b = fuzzCoordinate(LAT, LNG, 'item-456');
    expect(a).not.toEqual(b);
  });

  it('never moves the point further than the configured max offset', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'item-1', 'item-2']) {
      const fuzzed = fuzzCoordinate(LAT, LNG, seed, 60);
      const distance = haversineDistanceMeters(LAT, LNG, fuzzed.lat, fuzzed.lng);
      expect(distance).toBeLessThanOrEqual(60 + 0.01);
    }
  });

  it('actually moves the point (does not just return the original coordinate)', () => {
    const fuzzed = fuzzCoordinate(LAT, LNG, 'item-789');
    expect(fuzzed.lat === LAT && fuzzed.lng === LNG).toBe(false);
  });

  it('respects a custom max offset', () => {
    const fuzzed = fuzzCoordinate(LAT, LNG, 'item-custom', 20);
    const distance = haversineDistanceMeters(LAT, LNG, fuzzed.lat, fuzzed.lng);
    expect(distance).toBeLessThanOrEqual(20 + 0.01);
  });
});
