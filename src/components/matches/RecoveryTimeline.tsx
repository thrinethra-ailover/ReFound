import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../utils/date';
import type { MatchStatus, MatchStatusHistoryEntry } from '../../types/database';

const STAGE_ORDER: MatchStatus[] = [
  'POTENTIAL_MATCH',
  'VERIFICATION_PENDING',
  'VERIFIED',
  'RECOVERY_IN_PROGRESS',
  'HANDOFF_SCHEDULED',
  'RECOVERED',
];

const STAGE_LABEL: Record<MatchStatus, string> = {
  POTENTIAL_MATCH: 'Potential match detected',
  VERIFICATION_PENDING: 'Verification started',
  VERIFIED: 'Ownership verified',
  REJECTED: 'Marked not a match',
  RECOVERY_IN_PROGRESS: 'Recovery in progress',
  HANDOFF_SCHEDULED: 'Handoff arranged',
  RECOVERED: 'Item recovered',
};

interface RecoveryTimelineProps {
  matchId: string;
  itemReportedAt: string;
}

export function RecoveryTimeline({ matchId, itemReportedAt }: RecoveryTimelineProps) {
  const [history, setHistory] = useState<MatchStatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('match_status_history')
        .select('*')
        .eq('match_id', matchId)
        .order('changed_at', { ascending: true });
      if (!cancelled) {
        setHistory((data ?? []) as MatchStatusHistoryEntry[]);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (loading) return null;

  // Show REJECTED distinctly if that's how it ended, otherwise walk the happy path.
  const rejected = history.find((h) => h.status === 'REJECTED');
  const reachedStatuses = new Map(history.map((h) => [h.status, h.changed_at]));

  const stages = [
    { key: 'REPORTED', label: 'Item reported', timestamp: itemReportedAt },
    ...STAGE_ORDER.map((status) => ({
      key: status,
      label: STAGE_LABEL[status],
      timestamp: reachedStatuses.get(status) ?? null,
    })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate">Recovery timeline</p>
      <ol className="flex flex-col gap-0">
        {stages.map((stage, index) => {
          const reached = Boolean(stage.timestamp);
          const isLast = index === stages.length - 1;
          return (
            <li key={stage.key} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute left-[7px] top-4 h-full w-px ${reached ? 'bg-signal' : 'bg-border'}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 mt-0.5 h-4 w-4 flex-none rounded-full border-2 ${
                  reached ? 'border-signal bg-signal' : 'border-border bg-white'
                }`}
              />
              <div>
                <p className={`text-sm font-medium ${reached ? 'text-ink' : 'text-slate-light'}`}>{stage.label}</p>
                {stage.timestamp && (
                  <p className="text-xs text-slate-light">{formatDateTime(stage.timestamp)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {rejected && (
        <p className="text-xs text-coral-dark">
          This match was marked as not correct on {formatDateTime(rejected.changed_at)}.
        </p>
      )}
    </div>
  );
}
