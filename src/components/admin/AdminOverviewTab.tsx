import { useEffect, useState } from 'react';
import { StatCard } from './StatCard';
import { Spinner } from '../ui/Spinner';
import { fetchDashboardStats, fetchMatchAnalytics } from '../../lib/adminService';
import type { AdminDashboardStats, AdminMatchAnalytics } from '../../types/database';

export function AdminOverviewTab() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AdminMatchAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [statsResult, analyticsResult] = await Promise.all([fetchDashboardStats(), fetchMatchAnalytics()]);
      if (cancelled) return;
      if (statsResult.error || analyticsResult.error) {
        setError(statsResult.error ?? analyticsResult.error);
      }
      setStats(statsResult.stats);
      setAnalytics(analyticsResult.analytics);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error) return <p className="text-sm text-coral-dark">{error}</p>;
  if (!stats || !analytics) return null;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-display text-lg font-semibold text-ink">ReFound at a glance</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Active lost reports" value={stats.active_lost_count} />
          <StatCard label="Active found reports" value={stats.active_found_count} />
          <StatCard label="Potential matches" value={stats.potential_matches_count} />
          <StatCard label="Verified matches" value={stats.verified_matches_count} />
          <StatCard label="Recovered items" value={stats.recovered_count} />
          <StatCard
            label="Avg recovery time"
            value={stats.avg_recovery_hours !== null ? `${stats.avg_recovery_hours}h` : '—'}
          />
          <StatCard label="Reports this week" value={stats.reports_this_week} />
          <StatCard label="Recovery rate" value={`${stats.recovery_rate_pct}%`} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Match analytics</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Average match score" value={analytics.avg_score ?? '—'} />
          <StatCard label="Strong matches" value={analytics.strong_matches} hint="Score ≥ 80" />
          <StatCard label="Possible matches" value={analytics.possible_matches} hint="Score 60–79" />
          <StatCard label="Rejected matches" value={analytics.rejected_matches} />
          <StatCard label="Verified matches" value={analytics.verified_matches} />
          <StatCard label="Recovery conversion" value={`${analytics.recovery_conversion_pct}%`} />
        </div>
      </section>
    </div>
  );
}
