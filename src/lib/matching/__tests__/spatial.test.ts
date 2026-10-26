import { describe, expect, it } from 'vitest';
import { classifySpatialCompatibility } from '../spatial';

describe('classifySpatialCompatibility', () => {
  it('classifies close distances as High', () => {
    expect(classifySpatialCompatibility(0)).toBe('High');
    expect(classifySpatialCompatibility(120)).toBe('High');
    expect(classifySpatialCompatibility(150)).toBe('High');
  });

  it('classifies moderate distances as Medium', () => {
    expect(classifySpatialCompatibility(151)).toBe('Medium');
    expect(classifySpatialCompatibility(500)).toBe('Medium');
  });

  it('classifies far distances as Low', () => {
    expect(classifySpatialCompatibility(501)).toBe('Low');
    expect(classifySpatialCompatibility(5000)).toBe('Low');
  });

  it('classifies missing distance as Unknown', () => {
    expect(classifySpatialCompatibility(null)).toBe('Unknown');
  });

  it('has no gaps across a full range of distances', () => {
    for (let d = 0; d <= 2000; d += 25) {
      expect(['High', 'Medium', 'Low']).toContain(classifySpatialCompatibility(d));
    }
  });
});
