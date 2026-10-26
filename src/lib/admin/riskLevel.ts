// Mirrors the exact thresholds used in refresh_suspicious_activity()
// (supabase/migrations/0005_admin.sql) so the admin UI's risk badges always
// agree with what the database computed. Kept here, pure and tested,
// instead of duplicating magic numbers across components.

import type { RiskLevel } from '../../types/database';

export const RISK_THRESHOLDS = {
  high: 50,
  medium: 25,
} as const;

export function classifyRiskScore(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.high) return 'HIGH';
  if (score >= RISK_THRESHOLDS.medium) return 'MEDIUM';
  return 'LOW';
}

export const RULE_LABELS: Record<string, string> = {
  HIGH_FOUND_VOLUME: 'Unusually many found reports in 7 days',
  REPEATED_FAILED_VERIFICATION: 'Repeated failed ownership verification',
  REPEATED_REJECTED_CLAIMS: 'Repeated rejected claims',
  DUPLICATE_REPORTS: 'Suspicious duplicate reports',
  SCATTERED_LOCATIONS: 'Activity across many unrelated locations in 24h',
};

export function describeRule(rule: string): string {
  return RULE_LABELS[rule] ?? rule;
}
