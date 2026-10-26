import { useEffect, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../../hooks/useToast';
import { fetchSuspiciousActivityFlags, refreshSuspiciousActivity, reviewFlag } from '../../lib/adminService';
import { describeRule } from '../../lib/admin/riskLevel';
import { formatDateTime } from '../../utils/date';
import type { SuspiciousActivityFlag } from '../../types/database';

const RISK_TONE: Record<string, 'coral' | 'beacon' | 'slate'> = {
  HIGH: 'coral',
  MEDIUM: 'beacon',
  LOW: 'slate',
};

export function AdminSuspiciousActivityTab() {
  const { showToast } = useToast();
  const [flags, setFlags] = useState<SuspiciousActivityFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { flags: data, error } = await fetchSuspiciousActivityFlags();
    if (error) showToast(error, 'error');
    setFlags(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    const { flaggedCount, error } = await refreshSuspiciousActivity();
    setRefreshing(false);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast(`Recomputed — ${flaggedCount} user(s) currently flagged.`, 'success');
    await load();
  };

  const handleReview = async (flagId: string, status: 'REVIEWED' | 'DISMISSED') => {
    setBusyId(flagId);
    const { error } = await reviewFlag(flagId, status);
    setBusyId(null);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast(status === 'REVIEWED' ? 'Marked as reviewed.' : 'Flag dismissed.', 'success');
    await load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Suspicious activity</h2>
          <p className="text-xs text-slate-light">
            Rule-based, deterministic scoring — never an automatic ban. Every flag needs admin review.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleRefresh} loading={refreshing}>
          Recompute
        </Button>
      </div>

      {loading ? (
        <Spinner label="Loading flags…" />
      ) : flags.length === 0 ? (
        <EmptyState
          title="No flags right now"
          description="Click Recompute to run the rule-based checks against current activity."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {flags.map((flag) => (
            <div key={flag.id} className="rounded-card border border-border bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={RISK_TONE[flag.risk_level]}>{flag.risk_level} RISK</Badge>
                  <span className="font-mono text-xs text-slate-light">score {flag.risk_score}</span>
                  <span className="font-mono text-xs text-slate-light">user {flag.user_id.slice(0, 8)}…</span>
                </div>
                <Badge tone={flag.status === 'PENDING_REVIEW' ? 'beacon' : 'slate'}>
                  {flag.status.replace('_', ' ')}
                </Badge>
              </div>

              <ul className="mt-3 flex flex-col gap-1">
                {flag.rule_hits.map((hit, i) => (
                  <li key={i} className="text-sm text-slate">
                    {describeRule(hit.rule)} <span className="font-mono text-xs text-slate-light">(×{hit.count})</span>
                  </li>
                ))}
              </ul>

              <p className="mt-2 text-xs text-slate-light">Flagged {formatDateTime(flag.created_at)}</p>

              {flag.status === 'PENDING_REVIEW' && (
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <Button size="sm" onClick={() => handleReview(flag.id, 'REVIEWED')} loading={busyId === flag.id}>
                    Mark reviewed
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReview(flag.id, 'DISMISSED')}
                    loading={busyId === flag.id}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
