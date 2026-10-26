import { useEffect, useState } from 'react';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../../hooks/useToast';
import { fetchAuditLog } from '../../lib/adminService';
import { formatDateTime } from '../../utils/date';
import type { AuditEventType, AuditLogEntry } from '../../types/database';

const EVENT_LABEL: Record<AuditEventType, string> = {
  REPORT_CREATED: 'Report created',
  REPORT_UPDATED: 'Report updated',
  MATCH_GENERATED: 'Match generated',
  VERIFICATION_ATTEMPTED: 'Verification attempted',
  VERIFICATION_PASSED: 'Verification passed',
  VERIFICATION_REJECTED: 'Verification rejected',
  MESSAGE_SENT: 'Message sent',
  ITEM_RECOVERED: 'Item recovered',
  ADMIN_ACTION: 'Admin action',
};

const EVENT_TONE: Record<AuditEventType, 'signal' | 'beacon' | 'coral' | 'slate'> = {
  REPORT_CREATED: 'slate',
  REPORT_UPDATED: 'slate',
  MATCH_GENERATED: 'beacon',
  VERIFICATION_ATTEMPTED: 'beacon',
  VERIFICATION_PASSED: 'signal',
  VERIFICATION_REJECTED: 'coral',
  MESSAGE_SENT: 'slate',
  ITEM_RECOVERED: 'signal',
  ADMIN_ACTION: 'coral',
};

export function AdminAuditLogTab() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { entries: data, error } = await fetchAuditLog();
      if (cancelled) return;
      if (error) showToast(error, 'error');
      setEntries(data);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Audit log</h2>
        <p className="text-xs text-slate-light">
          The most recent 100 events. Message content is never logged — only that a message was sent.
        </p>
      </div>

      {loading ? (
        <Spinner label="Loading audit log…" />
      ) : entries.length === 0 ? (
        <EmptyState title="No audit events yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-white px-4 py-2.5 text-sm"
            >
              <Badge tone={EVENT_TONE[entry.event_type]}>
                {entry.event_type === 'ADMIN_ACTION' && entry.metadata.action === 'VIEW_HIDDEN_REPORT_DETAILS'
                  ? 'Private report details viewed'
                  : EVENT_LABEL[entry.event_type]}
              </Badge>
              <span className="text-xs text-slate-light">{formatDateTime(entry.created_at)}</span>
              {entry.target_type && (
                <span className="font-mono text-xs text-slate-light">
                  {entry.target_type}:{entry.target_id?.slice(0, 8)}…
                </span>
              )}
              {Object.keys(entry.metadata).length > 0 && (
                <span className="truncate text-xs text-slate" title={JSON.stringify(entry.metadata)}>
                  {Object.entries(entry.metadata)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
