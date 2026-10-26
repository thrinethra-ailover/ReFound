import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { formatRelativeDate } from '../../utils/date';

export function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(user?.id);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!user) return null;

  const handleOpen = () => {
    setOpen((v) => !v);
  };

  const handleClickNotification = async (id: string, type: string, relatedMatchId: string | null, relatedItemId: string | null) => {
    await markRead(id);
    setOpen(false);
    if (type === 'REPORT_STALE_REMINDER' || type === 'REPORT_ARCHIVED_STALE') {
      navigate('/dashboard');
    } else if (relatedMatchId) {
      navigate('/matches');
    } else if (relatedItemId) {
      navigate(`/map?focus=${encodeURIComponent(relatedItemId)}`);
    }
  };

  const notificationsToShow = notifications.slice(0, 8);

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white hover:bg-black/[0.02]"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path
            d="M6 9a6 6 0 1 1 12 0c0 3.4 1 5.2 1.6 6.1a1 1 0 0 1-.8 1.6H5.2a1 1 0 0 1-.8-1.6C5 14.2 6 12.4 6 9Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-2 w-80 max-w-[90vw] rounded-xl border border-border bg-white shadow-card-hover"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-signal hover:text-signal-dark">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notificationsToShow.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate">No notifications yet.</p>
            ) : (
              notificationsToShow.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n.id, n.type, n.related_match_id, n.related_item_id)}
                  className={`block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-black/[0.02] ${
                    n.is_read ? 'bg-white' : 'bg-signal/5'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-signal" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{n.title}</p>
                      <p className="mt-0.5 text-xs text-slate">{n.body}</p>
                      <p className="mt-1 text-[11px] text-slate-light">{formatRelativeDate(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          <Link
            to="/notifications"
            role="menuitem"
            onClick={(event) => {
              event.preventDefault();
              setOpen(false);
              navigate('/notifications');
            }}
            className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-signal hover:text-signal-dark"
          >
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
