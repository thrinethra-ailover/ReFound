import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { formatRelativeDate } from '../utils/date';

type FilterTab = 'UNREAD' | 'READ' | 'ALL';

export function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotifications(user?.id);
  const [tab, setTab] = useState<FilterTab>('UNREAD');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (tab === 'UNREAD') return notifications.filter((n) => !n.is_read);
    if (tab === 'READ') return notifications.filter((n) => n.is_read);
    return notifications;
  }, [notifications, tab]);

  const handleClick = async (id: string, isRead: boolean, type: string, relatedMatchId: string | null, relatedItemId: string | null) => {
    if (!isRead) await markRead(id);
    if (type === 'REPORT_STALE_REMINDER' || type === 'REPORT_ARCHIVED_STALE') navigate('/dashboard');
    else if (relatedMatchId) navigate('/matches');
    else if (relatedItemId) navigate(`/map?focus=${encodeURIComponent(relatedItemId)}`);
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-slate">Everything ReFound has let you know about.</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-sm font-medium text-signal hover:text-signal-dark">
            Mark all read
          </button>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {(['UNREAD', 'READ', 'ALL'] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-ink text-white' : 'bg-white text-ink border border-border hover:bg-black/[0.02]'
            }`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
            {t === 'UNREAD' && unreadCount > 0 && (
              <span className="ml-1.5 font-mono text-xs opacity-70">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <Spinner label="Loading notifications…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={tab === 'UNREAD' ? 'You\u2019re all caught up' : 'Nothing here yet'}
            description="Notifications about matches, saved searches, verification, messages, and recovery updates will show up here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => handleClick(n.id, n.is_read, n.type, n.related_match_id, n.related_item_id)}
                  className={`flex w-full items-start gap-3 rounded-card border px-4 py-3 text-left transition-colors ${
                    n.is_read ? 'border-border bg-white' : 'border-signal/30 bg-signal/5'
                  } hover:bg-black/[0.02]`}
                >
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-signal" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    <p className="mt-0.5 text-sm text-slate">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-light">{formatRelativeDate(n.created_at)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
