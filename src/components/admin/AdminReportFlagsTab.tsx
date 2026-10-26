import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../../hooks/useToast';
import { actOnFlaggedReport, fetchReportAbuseFlags, reviewReportAbuseFlag, type ReportAbuseFlag } from '../../lib/communityService';
import { formatDateTime } from '../../utils/date';

export function AdminReportFlagsTab() {
  const { showToast } = useToast();
  const [flags, setFlags] = useState<ReportAbuseFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ flag: ReportAbuseFlag; action: 'RESOLVE' | 'DEACTIVATE' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { flags: rows, error } = await fetchReportAbuseFlags();
    setFlags(rows);
    if (error) showToast(error, 'error');
    setLoading(false);
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const review = async (flag: ReportAbuseFlag, status: 'REVIEWED' | 'DISMISSED') => {
    setBusyId(flag.id);
    const { error } = await reviewReportAbuseFlag(flag.id, status);
    setBusyId(null);
    if (error) showToast(error, 'error');
    else { showToast(status === 'REVIEWED' ? 'Report flag reviewed.' : 'Report flag dismissed.', 'success'); await load(); }
  };

  const carryOutAction = async () => {
    if (!pendingAction) return;
    const { flag, action } = pendingAction;
    setBusyId(flag.id);
    const { error } = await actOnFlaggedReport(flag.id, action);
    setBusyId(null);
    if (error) showToast(error, 'error');
    else {
      showToast(action === 'RESOLVE' ? 'Report marked resolved and flag reviewed.' : 'Listing deactivated and flag reviewed.', 'success');
      setPendingAction(null);
      await load();
    }
  };

  if (loading) return <Spinner label="Loading user reports…" />;
  if (!flags.length) return <EmptyState title="No user flags" description="Reports flagged by the campus community will appear here for admin review." />;

  return <div className="flex flex-col gap-3">
    <div><h2 className="font-display text-lg font-semibold text-ink">User-submitted report flags</h2><p className="text-xs text-slate-light">Flaggers are not identified to the report owner.</p></div>
    {flags.map((flag) => <article key={flag.id} className="rounded-card border border-border bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="font-semibold text-ink">{flag.item?.title ?? 'Report removed'}</p><p className="text-xs text-slate">{flag.item?.report_type ?? '—'} · Reason: {flag.reason.replace('_',' ').toLowerCase()}</p>
          {flag.item && <Link to={`/map?focus=${encodeURIComponent(flag.item_id)}`} className="mt-1 inline-block text-xs font-medium text-signal hover:text-signal-dark">View report</Link>}
        </div>
        <Badge tone={flag.status === 'PENDING' ? 'beacon' : 'slate'}>{flag.status}</Badge>
      </div>
      {flag.details && <p className="mt-3 whitespace-pre-wrap text-sm text-slate">{flag.details}</p>}
      <p className="mt-2 text-xs text-slate-light">Submitted {formatDateTime(flag.created_at)} · Listing status: {flag.item?.status ?? 'removed'}</p>
      {flag.status === 'PENDING' && <div className="mt-3 flex gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={() => void review(flag,'REVIEWED')} loading={busyId === flag.id}>Mark reviewed</Button>
        <Button size="sm" variant="ghost" onClick={() => void review(flag,'DISMISSED')} loading={busyId === flag.id}>Dismiss</Button>
        {flag.item?.status === 'ACTIVE' && <>
          <Button size="sm" variant="secondary" disabled={busyId === flag.id} onClick={() => setPendingAction({ flag, action: 'RESOLVE' })}>Mark report resolved</Button>
          <Button size="sm" variant="danger" disabled={busyId === flag.id} onClick={() => setPendingAction({ flag, action: 'DEACTIVATE' })}>Deactivate listing</Button>
        </>}
      </div>}
    </article>)}
    <Modal open={Boolean(pendingAction)} onClose={() => setPendingAction(null)}
      title={pendingAction?.action === 'RESOLVE' ? 'Mark this report resolved?' : 'Deactivate this listing?'}
      footer={<>
        <Button variant="ghost" onClick={() => setPendingAction(null)}>Cancel</Button>
        <Button variant={pendingAction?.action === 'DEACTIVATE' ? 'danger' : 'primary'} onClick={() => void carryOutAction()} loading={busyId === pendingAction?.flag.id}>
          {pendingAction?.action === 'RESOLVE' ? 'Resolve report' : 'Deactivate listing'}
        </Button>
      </>}>
      This will {pendingAction?.action === 'RESOLVE' ? 'move the report out of active matching' : 'remove the listing from ReFound and active matching'} and mark this flag reviewed. The action is recorded in the admin audit log.
    </Modal>
  </div>;
}
