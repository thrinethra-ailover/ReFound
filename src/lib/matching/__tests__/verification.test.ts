import { describe, expect, it } from 'vitest';
import {
  attributeValuesMatch,
  normalizeAttributeValue,
  summarizeVerification,
  type VerificationAttempt,
} from '../verification';

describe('normalizeAttributeValue', () => {
  it('ignores capitalization and ordinary grammar words', () => {
    expect(normalizeAttributeValue('  Small Robot Sticker ')).toBe('small robot sticker');
    expect(normalizeAttributeValue("There's a small robot sticker on the back")).toBe(
      'back robot small sticker'
    );
  });

  it('collapses internal whitespace runs', () => {
    expect(normalizeAttributeValue('robot   sticker')).toBe('robot sticker');
  });
});

describe('attributeValuesMatch (blind verification comparison)', () => {
  it('matches identical values', () => {
    expect(attributeValuesMatch('Small scratch on the left corner', 'Small scratch on the left corner')).toBe(
      true
    );
  });

  it('matches case-insensitively and ignoring surrounding whitespace', () => {
    expect(attributeValuesMatch('  SMALL scratch  ', 'small scratch')).toBe(true);
  });

  it('matches when spacing differs inside the answer', () => {
    expect(attributeValuesMatch('small   robot   sticker', 'small robot sticker')).toBe(true);
  });

  it('matches different sentence grammar around the same identifying detail', () => {
    expect(
      attributeValuesMatch(
        'Small robot sticker, bottom-left corner',
        "There's a small robot sticker in the bottom left corner"
      )
    ).toBe(true);
  });

  it('keeps distinctive words meaningful', () => {
    expect(attributeValuesMatch('small robot sticker on back', 'small robot sticker on front')).toBe(false);
    expect(attributeValuesMatch('blue star sticker', 'red star sticker')).toBe(false);
  });

  it('does not match different values', () => {
    expect(attributeValuesMatch('Small scratch', 'Large dent')).toBe(false);
  });

  it('does not match on empty input either side', () => {
    expect(attributeValuesMatch('', 'small scratch')).toBe(false);
    expect(attributeValuesMatch('small scratch', '')).toBe(false);
    expect(attributeValuesMatch('', '')).toBe(false);
  });

  it('never requires exposing which characters differed (boolean-only contract)', () => {
    const result = attributeValuesMatch('sticker on back', 'sticker on front');
    expect(typeof result).toBe('boolean');
  });
});

describe('summarizeVerification', () => {
  it('reports allCorrect and passed when every attempt is correct', () => {
    const attempts: VerificationAttempt[] = [
      { attributeKey: 'sticker', isCorrect: true },
      { attributeKey: 'scratch', isCorrect: true },
    ];
    const summary = summarizeVerification(attempts);
    expect(summary.totalQuestions).toBe(2);
    expect(summary.correctAnswers).toBe(2);
    expect(summary.allCorrect).toBe(true);
    expect(summary.passed).toBe(true);
  });

  it('passes on a strict majority, not merely half', () => {
    const attempts: VerificationAttempt[] = [
      { attributeKey: 'a', isCorrect: true },
      { attributeKey: 'b', isCorrect: false },
    ];
    const summary = summarizeVerification(attempts);
    expect(summary.passed).toBe(false); // exactly half, not a majority
    expect(summary.allCorrect).toBe(false);
  });

  it('fails when no attempts have been made', () => {
    const summary = summarizeVerification([]);
    expect(summary.totalQuestions).toBe(0);
    expect(summary.passed).toBe(false);
    expect(summary.allCorrect).toBe(false);
  });

  it('passes with a clear majority of correct answers', () => {
    const attempts: VerificationAttempt[] = [
      { attributeKey: 'a', isCorrect: true },
      { attributeKey: 'b', isCorrect: true },
      { attributeKey: 'c', isCorrect: false },
    ];
    const summary = summarizeVerification(attempts);
    expect(summary.passed).toBe(true);
    expect(summary.allCorrect).toBe(false);
  });
});
