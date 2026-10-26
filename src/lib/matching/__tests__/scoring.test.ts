import { describe, expect, it } from 'vitest';
import {
  haversineDistanceMeters,
  scoreCategory,
  scoreColor,
  scoreKeywords,
  scoreLocation,
  scoreTime,
  computeWeightedScore,
  classifyConfidence,
  minutesBetween,
} from '../scoring';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistanceMeters(37.7749, -122.4194, 37.7749, -122.4194)).toBe(0);
  });

  it('computes a known real-world distance within a small tolerance', () => {
    // San Francisco City Hall to Ferry Building — roughly 2.9km apart.
    const distance = haversineDistanceMeters(37.7793, -122.4193, 37.7955, -122.3937);
    expect(distance).toBeGreaterThan(2700);
    expect(distance).toBeLessThan(3100);
  });

  it('is symmetric', () => {
    const d1 = haversineDistanceMeters(37.77, -122.41, 37.79, -122.39);
    const d2 = haversineDistanceMeters(37.79, -122.39, 37.77, -122.41);
    expect(d1).toBeCloseTo(d2, 6);
  });
});

describe('scoreLocation (distance scoring)', () => {
  it('scores 100 at zero distance', () => {
    expect(scoreLocation(0)).toBe(100);
  });

  it('scores 0 at or beyond the max match distance', () => {
    expect(scoreLocation(1500)).toBe(0);
    expect(scoreLocation(5000)).toBe(0);
  });

  it('decays linearly between 0 and the max distance', () => {
    expect(scoreLocation(750)).toBe(50);
    expect(scoreLocation(120)).toBe(92);
  });

  it('is neutral (50) when location data is unavailable', () => {
    expect(scoreLocation(null)).toBe(50);
  });
});

describe('scoreTime (temporal scoring)', () => {
  it('scores 100 at zero minutes difference', () => {
    expect(scoreTime(0)).toBe(100);
  });

  it('scores 0 at or beyond the max match window (3 days)', () => {
    expect(scoreTime(3 * 24 * 60)).toBe(0);
    expect(scoreTime(10 * 24 * 60)).toBe(0);
  });

  it('treats negative and positive differences symmetrically', () => {
    expect(scoreTime(-35)).toBe(scoreTime(35));
  });

  it('decays proportionally within the window', () => {
    expect(scoreTime(35)).toBe(99); // ~35 min out of 4320 min window
    expect(scoreTime(2160)).toBe(50); // exactly half the window
  });

  it('is neutral (50) when a datetime is unavailable', () => {
    expect(scoreTime(null)).toBe(50);
  });
});

describe('scoreCategory', () => {
  it('scores 100 for an exact match', () => {
    expect(scoreCategory('Electronics', 'Electronics')).toBe(100);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(scoreCategory('  electronics ', 'Electronics')).toBe(100);
  });

  it('scores 0 for different categories', () => {
    expect(scoreCategory('Electronics', 'Keys')).toBe(0);
  });
});

describe('scoreColor', () => {
  it('scores 100 for an exact match', () => {
    expect(scoreColor('Black', 'Black')).toBe(100);
  });

  it('scores 0 for a mismatch', () => {
    expect(scoreColor('Black', 'Blue')).toBe(0);
  });

  it('is neutral (50) when either side is unspecified', () => {
    expect(scoreColor(null, 'Black')).toBe(50);
    expect(scoreColor('Black', null)).toBe(50);
    expect(scoreColor(null, null)).toBe(50);
  });
});

describe('scoreKeywords', () => {
  it('scores high overlap for near-identical descriptions', () => {
    const score = scoreKeywords(
      'Black North Face backpack with laptop sleeve',
      'Black North Face backpack, has a laptop sleeve inside'
    );
    expect(score).toBeGreaterThan(60);
  });

  it('scores 0 for completely unrelated text', () => {
    const score = scoreKeywords('Blue water bottle', 'Silver house keys on a red lanyard');
    expect(score).toBe(0);
  });

  it('scores 0 when either text is empty or only stopwords', () => {
    expect(scoreKeywords('', 'Black backpack')).toBe(0);
    expect(scoreKeywords('the a an', 'Black backpack')).toBe(0);
  });

  it('is symmetric', () => {
    const a = 'Silver wired earbuds in a white case';
    const b = 'White case with silver earbuds';
    expect(scoreKeywords(a, b)).toBe(scoreKeywords(b, a));
  });
});

describe('minutesBetween', () => {
  it('computes a positive difference when A is after B', () => {
    expect(minutesBetween('2026-01-01T12:35:00Z', '2026-01-01T12:00:00Z')).toBe(35);
  });

  it('computes a negative difference when A is before B', () => {
    expect(minutesBetween('2026-01-01T12:00:00Z', '2026-01-01T12:35:00Z')).toBe(-35);
  });
});

describe('computeWeightedScore', () => {
  it('weights each component according to the documented model', () => {
    // category 20%, keyword 20%, colorAttributes 10%, location 25%, time 25%
    const score = computeWeightedScore({
      category: 100,
      keyword: 100,
      colorAttributes: 100,
      location: 100,
      time: 100,
    });
    expect(score).toBe(100);
  });

  it('produces 0 when every component is 0', () => {
    const score = computeWeightedScore({
      category: 0,
      keyword: 0,
      colorAttributes: 0,
      location: 0,
      time: 0,
    });
    expect(score).toBe(0);
  });

  it('computes the documented worked example precisely', () => {
    // category 100*0.2=20, keyword 50*0.2=10, color 100*0.1=10,
    // location 92*0.25=23, time 99*0.25=24.75 -> total 87.75 -> rounds to 88
    const score = computeWeightedScore({
      category: 100,
      keyword: 50,
      colorAttributes: 100,
      location: 92,
      time: 99,
    });
    expect(score).toBe(88);
  });
});

describe('classifyConfidence (threshold classification)', () => {
  it('classifies 80 and above as STRONG', () => {
    expect(classifyConfidence(80)).toBe('STRONG');
    expect(classifyConfidence(100)).toBe('STRONG');
  });

  it('classifies 60-79 as POSSIBLE', () => {
    expect(classifyConfidence(60)).toBe('POSSIBLE');
    expect(classifyConfidence(79)).toBe('POSSIBLE');
  });

  it('classifies below 60 as LOW', () => {
    expect(classifyConfidence(59)).toBe('LOW');
    expect(classifyConfidence(0)).toBe('LOW');
  });

  it('has no gaps or overlaps at the boundaries', () => {
    for (let score = 0; score <= 100; score++) {
      const confidence = classifyConfidence(score);
      if (score >= 80) expect(confidence).toBe('STRONG');
      else if (score >= 60) expect(confidence).toBe('POSSIBLE');
      else expect(confidence).toBe('LOW');
    }
  });
});
