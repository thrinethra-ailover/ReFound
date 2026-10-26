import { describe, expect, it } from 'vitest';
import { classifyRiskScore, describeRule } from '../riskLevel';

describe('classifyRiskScore', () => {
  it('classifies 50 and above as HIGH', () => {
    expect(classifyRiskScore(50)).toBe('HIGH');
    expect(classifyRiskScore(100)).toBe('HIGH');
  });

  it('classifies 25-49 as MEDIUM', () => {
    expect(classifyRiskScore(25)).toBe('MEDIUM');
    expect(classifyRiskScore(49)).toBe('MEDIUM');
  });

  it('classifies below 25 as LOW', () => {
    expect(classifyRiskScore(24)).toBe('LOW');
    expect(classifyRiskScore(0)).toBe('LOW');
  });

  it('has no gaps or overlaps at the boundaries', () => {
    for (let score = 0; score <= 150; score++) {
      const level = classifyRiskScore(score);
      if (score >= 50) expect(level).toBe('HIGH');
      else if (score >= 25) expect(level).toBe('MEDIUM');
      else expect(level).toBe('LOW');
    }
  });
});

describe('describeRule', () => {
  it('returns a human-readable label for known rules', () => {
    expect(describeRule('HIGH_FOUND_VOLUME')).toContain('found reports');
    expect(describeRule('REPEATED_FAILED_VERIFICATION')).toContain('verification');
  });

  it('falls back to the raw rule name for unknown rules', () => {
    expect(describeRule('SOME_NEW_RULE')).toBe('SOME_NEW_RULE');
  });
});
