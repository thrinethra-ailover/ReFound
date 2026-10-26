import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProximityAssist } from '../../hooks/useProximityAssist';
import { buildProximityAlertMessage } from '../../lib/proximity';

export function ProximityAlertBanner() {
  const { user } = useAuth();
  const { alerts, dismissAlert } = useProximityAssist();

  if (!user || alerts.length === 0) return null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 pt-4 sm:px-6">
      {alerts.map((alert) => {
        const message = buildProximityAlertMessage(alert.category);
        return (
          <div
            key={alert.key}
            role="status"
            className="flex items-start gap-3 rounded-card border border-beacon/40 bg-beacon/10 px-4 py-3"
          >
            <span className="text-xl leading-none" aria-hidden="true">
              🔎
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Keep an eye out!</p>
              <p className="mt-0.5 text-sm text-slate">{message.body}</p>
              <div className="mt-2 flex gap-3">
                <Link
                  to="/report"
                  className="text-xs font-semibold text-signal hover:text-signal-dark"
                  onClick={() => dismissAlert(alert.key)}
                >
                  Report it
                </Link>
                <button
                  onClick={() => dismissAlert(alert.key)}
                  className="text-xs font-medium text-slate hover:text-ink"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
