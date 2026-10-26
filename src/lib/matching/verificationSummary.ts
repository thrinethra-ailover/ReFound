export interface VerificationAttempt {
  attributeKey: string;
  isCorrect: boolean;
  attemptsUsed?: number;
}

export interface VerificationSummary {
  totalQuestions: number;
  correctAnswers: number;
  allCorrect: boolean;
  passed: boolean;
}

/** Summarize attempts per prompt so retries do not inflate the question count. */
export function summarizeVerification(attempts: VerificationAttempt[]): VerificationSummary {
  const byAttribute = new Map<string, boolean>();
  for (const attempt of attempts) {
    byAttribute.set(attempt.attributeKey, (byAttribute.get(attempt.attributeKey) ?? false) || attempt.isCorrect);
  }
  const totalQuestions = byAttribute.size;
  const correctAnswers = [...byAttribute.values()].filter(Boolean).length;
  const allCorrect = totalQuestions > 0 && correctAnswers === totalQuestions;
  const passed = totalQuestions > 0 && correctAnswers / totalQuestions > 0.5;
  return { totalQuestions, correctAnswers, allCorrect, passed };
}
