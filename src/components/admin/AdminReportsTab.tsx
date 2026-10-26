import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../../hooks/useToast';
import { deactivateItem, fetchActiveReportDetails, fetchAllItems, resolveItemAsAdmin } from '../../lib/adminService';
import { formatDateTime, formatRelativeDate } from '../../utils/date';
import { getItemImageUrl } from '../../lib/itemService';
import type { AdminReportDetails, ItemWithImages, ItemStatus } from '../../types/database';

type FilterTab = 'ALL' | 'ACTIVE' | 'RESOLVED' | 'CANCELLED';

const STATUS_TONE: Record<ItemStatus, 'signal' | 'beacon' | 'slate'> = {
  ACTIVE: 'signal',
  RESOLVED: 'beacon',
  CANCELLED: 'slate',
};

export function AdminReportsTab({ canViewPrivateDetails = true }: { canViewPrivateDetails?: boolean }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<ItemWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('ACTIVE');
  const [deactivateTarget, setDeactivateTarget] = useState<ItemWithImages | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState<AdminReportDetails | null>(null);
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);
  const detailsRequestId = useRef<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { items: data, error } = await fetchAllItems();
    if (error) showToast(error, 'error');
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'ALL') return items;
    return items.filter((item) => item.status === tab);
  }, [items, tab]);

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setBusyId(deactivateTarget.id);
    const { error } = await deactivateItem(deactivateTarget.id, reason.trim() || 'No reason provided');
    setBusyId(null);
    setDeactivateTarget(null);
    setReason('');
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast('Report deactivated.', 'success');
    await load();
  };

  const handleResolve = async (item: ItemWithImages) => {
    setBusyId(item.id);
    const { error } = await resolveItemAsAdmin(item.id);
    setBusyId(null);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast('Report marked resolved.', 'success');
    await load();
  };

  const handleViewDetails = async (item: ItemWithImages) => {
    if (!canViewPrivateDetails) return;
    if (expandedReportId === item.id) {
      detailsRequestId.current = null;
      setExpandedReportId(null);
      setReportDetails(null);
      return;
    }

    setExpandedReportId(item.id);
    detailsRequestId.current = item.id;
    setReportDetails(null);
    setDetailsLoadingId(item.id);
    const { details, error } = await fetchActiveReportDetails(item.id);
    if (detailsRequestId.current !== item.id) return;
    setDetailsLoadingId(null);
    if (error) {
      setExpandedReportId(null);
      showToast(error, 'error');
      return;
    }
    setReportDetails(details);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Reports</h2>
        <p className="text-xs text-slate-light">
          {canViewPrivateDetails ? 'Browse reports and inspect private ownership details for active reports. Each private detail view and action is recorded.' : 'Browse reports and manage their status. Private ownership verification details are restricted to the Creator.'}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['ACTIVE', 'RESOLVED', 'CANCELLED', 'ALL'] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-ink text-white' : 'bg-white text-ink border border-border hover:bg-black/[0.02]'
            }`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading reports…" />
      ) : filtered.length === 0 ? (
        <EmptyState title="No reports in this view" />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-slate">
                <th className="px-4 py-2.5">Report</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Reported</th>
                <th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <Fragment key={item.id}>
                  <tr className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-slate-light">{item.category}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={item.report_type === 'LOST' ? 'signal' : 'beacon'}>{item.report_type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-light">{formatRelativeDate(item.created_at)}</td>
                  <td className="px-4 py-3">
                    {item.status === 'ACTIVE' && (
                      <div className="flex gap-2">
                        {canViewPrivateDetails && <Button size="sm" variant="ghost" onClick={() => void handleViewDetails(item)} disabled={detailsLoadingId === item.id}>
                          {detailsLoadingId === item.id ? 'Loading…' : expandedReportId === item.id ? 'Hide details' : 'View details'}
                        </Button>}
                        <Button size="sm" variant="secondary" onClick={() => handleResolve(item)} loading={busyId === item.id}>
                          Resolve
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeactivateTarget(item)} disabled={busyId === item.id}>
                          Deactivate
                        </Button>
                      </div>
                    )}
                  </td>
                  </tr>
                  {canViewPrivateDetails && expandedReportId === item.id && (
                    <tr className="admin-report-details-row border-b border-border bg-slate-50/70">
                      <td colSpan={5} className="px-4 py-4">
                        {detailsLoadingId === item.id || !reportDetails ? (
                          <Spinner label="Loading report details…" />
                        ) : (
                          <ReportDetailsPanel details={reportDetails} />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate this report?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeactivate} loading={busyId === deactivateTarget?.id}>
              Deactivate
            </Button>
          </>
        }
      >
        <p className="mb-3">
          This removes &ldquo;{deactivateTarget?.title}&rdquo; from active matching. This action is recorded in
          the audit log.
        </p>
        <label className="text-sm font-medium text-ink">Reason (recommended)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-signal"
          rows={3}
          maxLength={500}
          placeholder="e.g. duplicate report, suspected fraud, reporter request…"
        />
      </Modal>
    </div>
  );
}

function ReportDetailsPanel({ details }: { details: AdminReportDetails }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-ink">Report details</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-light">Title</dt><dd className="text-ink">{details.title}</dd>
          <dt className="text-slate-light">Type</dt><dd className="text-ink">{details.report_type}</dd>
          <dt className="text-slate-light">Category</dt><dd className="text-ink">{details.category}</dd>
          <dt className="text-slate-light">Color</dt><dd className="text-ink">{details.color || 'Not specified'}</dd>
          <dt className="text-slate-light">Location</dt><dd className="text-ink">{details.location_name || 'Not specified'}</dd>
          <dt className="text-slate-light">When</dt><dd className="text-ink">{formatDateTime(details.item_datetime)}</dd>
          <dt className="text-slate-light">Report ID</dt><dd className="font-mono text-xs text-ink">{details.id}</dd>
        </dl>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-light">Description</p>
          <p className="whitespace-pre-wrap text-sm text-ink">{details.description || 'No description provided.'}</p>
        </div>
        {details.item_images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {details.item_images.map((image) => (
              <img
                key={image.id}
                src={getItemImageUrl(image.storage_path)}
                alt={`${details.title} report photo`}
                className="h-24 w-24 rounded-lg border border-border object-cover"
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-coral/30 bg-coral/5 p-4">
        <h3 className="font-semibold text-ink">Private ownership details</h3>
        <p className="mb-3 mt-1 text-xs text-slate">
          Only the Creator can see these verification answers. Each view is recorded in the audit log.
        </p>
        {details.verification_attributes.length === 0 ? (
          <p className="text-sm text-slate">No private verification details were saved for this report.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {details.verification_attributes.map((attribute) => (
              <li key={attribute.id} className="rounded-md bg-white px-3 py-2 text-sm">
                <span className="font-medium text-ink">{attribute.attribute_key}</span>
                <span className="text-slate"> — {attribute.attribute_value}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
