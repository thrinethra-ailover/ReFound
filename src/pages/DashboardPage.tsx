import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ItemGrid } from '../components/items/ItemGrid';
import { EditReportModal } from '../components/items/EditReportModal';
import { useAuth } from '../hooks/useAuth';
import { useMyItems } from '../hooks/useItems';
import { useToast } from '../hooks/useToast';
import type { ItemWithImages } from '../types/database';
import { confirmOwnItemActive, refreshMyStaleReports } from '../lib/itemService';

type FilterTab = 'ALL' | 'LOST' | 'FOUND' | 'RESOLVED';

export function DashboardPage() {
  const { user, profile } = useAuth();
  const { items, loading, error, updateStatus, deleteItem, refresh } = useMyItems(user?.id);
  const { showToast } = useToast();

  const [tab, setTab] = useState<FilterTab>('ALL');
  const [pendingDelete, setPendingDelete] = useState<ItemWithImages | null>(null);
  const [pendingResolve, setPendingResolve] = useState<ItemWithImages | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<ItemWithImages | null>(null);

  useEffect(() => {
    if (!user) return;
    void refreshMyStaleReports().then(({ count }) => {
      if (count > 0) void refresh();
    });
  }, [user, refresh]);

  const filtered = useMemo(() => {
    switch (tab) {
      case 'LOST':
        return items.filter((i) => i.report_type === 'LOST' && i.status === 'ACTIVE');
      case 'FOUND':
        return items.filter((i) => i.report_type === 'FOUND' && i.status === 'ACTIVE');
      case 'RESOLVED':
        return items.filter((i) => i.status !== 'ACTIVE');
      default:
        return items;
    }
  }, [items, tab]);

  const counts = useMemo(
    () => ({
      ALL: items.length,
      LOST: items.filter((i) => i.report_type === 'LOST' && i.status === 'ACTIVE').length,
      FOUND: items.filter((i) => i.report_type === 'FOUND' && i.status === 'ACTIVE').length,
      RESOLVED: items.filter((i) => i.status !== 'ACTIVE').length,
    }),
    [items]
  );

  const handleResolve = async () => {
    if (!pendingResolve) return;
    setBusyId(pendingResolve.id);
    const { error: resolveError } = await updateStatus(pendingResolve.id, 'RESOLVED');
    setBusyId(null);
    setPendingResolve(null);
    if (resolveError) showToast(resolveError, 'error');
    else showToast('Report marked as resolved.', 'success');
  };

  const handleCancel = async () => {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    const { error: cancelError } = await deleteItem(pendingDelete.id);
    setBusyId(null);
    setPendingDelete(null);
    if (cancelError) showToast(cancelError, 'error');
    else showToast('Report cancelled.', 'success');
  };

  const handleReopen = async (item: ItemWithImages) => {
    setBusyId(item.id);
    const { error: reopenError } = await updateStatus(item.id, 'ACTIVE');
    setBusyId(null);
    if (reopenError) showToast(reopenError, 'error');
    else showToast('Report reopened and added back to active reports.', 'success');
  };

  const handleConfirmActive = async (item: ItemWithImages) => {
    setBusyId(item.id);
    const { error: confirmError } = await confirmOwnItemActive(item.id);
    setBusyId(null);
    if (confirmError) showToast(confirmError, 'error');
    else { await refresh(); showToast('Report confirmed active for another 30 days.', 'success'); }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-sm text-slate">Track your lost and found reports here.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/matches">
            <Button size="md" variant="secondary">
              View matches
            </Button>
          </Link>
          <Link to="/report">
            <Button size="md">+ Report an item</Button>
          </Link>
        </div>
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
        {(['ALL', 'LOST', 'FOUND', 'RESOLVED'] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-ink text-white' : 'bg-white text-ink border border-border hover:bg-black/[0.02]'
            }`}
          >
            {t === 'ALL' ? 'All reports' : t === 'RESOLVED' ? 'Resolved & cancelled' : `My ${t.toLowerCase()} items`}{' '}
            <span className="font-mono text-xs opacity-70">{counts[t]}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral-dark" role="alert">
          {error}
        </div>
      )}

      <div className="mt-6">
        <ItemGrid
          items={filtered}
          loading={loading}
          emptyTitle={tab === 'ALL' ? 'No reports yet' : 'Nothing here yet'}
          emptyDescription="Report a lost or found item to get started — ReFound will start watching for matches."
          emptyAction={
            <Link to="/report">
              <Button size="sm">Report an item</Button>
            </Link>
          }
          renderActions={(item) =>
            item.status === 'ACTIVE' ? (
              <>
                {item.stale_reminded_at && (
                  <div className="mb-2 w-full rounded-lg border border-beacon/40 bg-beacon/10 p-3 text-left text-xs text-ink">
                    If you do not confirm within 7 days, ReFound will archive it the next time your dashboard checks after that grace period.
                    <div className="mt-2"><Button size="sm" disabled={busyId === item.id} onClick={() => void handleConfirmActive(item)}>Keep active</Button></div>
                  </div>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditItem(item)}>Edit</Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === item.id}
                  onClick={() => setPendingResolve(item)}
                >
                  Mark resolved
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === item.id}
                  onClick={() => setPendingDelete(item)}
                >
                  Cancel
                </Button>
              </>
            ) : item.status === 'RESOLVED' ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditItem(item)}>Edit</Button>
                <Button size="sm" variant="secondary" disabled={busyId === item.id} onClick={() => void handleReopen(item)}>Reopen</Button>
              </>
            ) : null
          }
        />
      </div>

      <Modal
        open={Boolean(pendingResolve)}
        onClose={() => setPendingResolve(null)}
        title="Mark this report as resolved?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingResolve(null)}>
              Keep active
            </Button>
            <Button onClick={handleResolve} loading={busyId === pendingResolve?.id}>
              Mark resolved
            </Button>
          </>
        }
      >
        This moves &ldquo;{pendingResolve?.title}&rdquo; out of active matching. You can reopen it later from your dashboard.
      </Modal>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Cancel this report?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Keep report
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={busyId === pendingDelete?.id}>
              Cancel report
            </Button>
          </>
        }
      >
        This permanently removes &ldquo;{pendingDelete?.title}&rdquo; and any photos attached to it.
      </Modal>

      <EditReportModal item={editItem} reporterId={user?.id ?? ''} onClose={() => setEditItem(null)} onSaved={() => { void refresh(); showToast('Report updated.', 'success'); }} />

    </div>
  );
}
