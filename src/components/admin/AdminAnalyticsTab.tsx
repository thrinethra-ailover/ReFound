import { useEffect, useState } from 'react';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import {
  fetchCategoryFrequency,
  fetchLocationHeatmap,
  fetchRecoveryHotspots,
  fetchTimeDistribution,
} from '../../lib/adminService';
import type {
  CategoryFrequencyRow,
  LocationHeatmapRow,
  RecoveryHotspotRow,
  TimeDistributionRow,
} from '../../types/database';

function BarRow({ label, count, max, tone }: { label: string; count: number; max: number; tone: string }) {
  const widthPct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 flex-none truncate text-xs text-slate" title={label}>
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${widthPct}%` }} />
      </div>
      <span className="w-8 flex-none text-right font-mono text-xs text-ink">{count}</span>
    </div>
  );
}

export function AdminAnalyticsTab() {
  const [heatmap, setHeatmap] = useState<LocationHeatmapRow[]>([]);
  const [hotspots, setHotspots] = useState<RecoveryHotspotRow[]>([]);
  const [categories, setCategories] = useState<CategoryFrequencyRow[]>([]);
  const [timeDistribution, setTimeDistribution] = useState<TimeDistributionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [h, r, c, t] = await Promise.all([
        fetchLocationHeatmap(),
        fetchRecoveryHotspots(),
        fetchCategoryFrequency(),
        fetchTimeDistribution(),
      ]);
      if (cancelled) return;
      setHeatmap(h.rows);
      setHotspots(r.rows);
      setCategories(c.rows);
      setTimeDistribution(t.rows);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner label="Loading analytics…" />;

  const maxHeatmap = Math.max(1, ...heatmap.map((r) => r.report_count));
  const maxHotspot = Math.max(1, ...hotspots.map((r) => r.recovered_count));
  const categoryByName = categories.reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + row.report_count;
    return acc;
  }, {});
  const maxCategory = Math.max(1, ...Object.values(categoryByName));
  const maxHour = Math.max(1, ...timeDistribution.map((r) => r.report_count));

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Most common report locations</h2>
        <p className="text-xs text-slate-light">
          Grouped by the location name reporters typed — never individual coordinates or reporters.
        </p>
        {heatmap.length === 0 ? (
          <EmptyState title="No location data yet" />
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {heatmap.slice(0, 12).map((row) => (
              <BarRow
                key={`${row.location_name}-${row.report_type}`}
                label={`${row.location_name} (${row.report_type})`}
                count={row.report_count}
                max={maxHeatmap}
                tone={row.report_type === 'LOST' ? 'bg-signal' : 'bg-beacon'}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Recovery hotspots</h2>
        <p className="text-xs text-slate-light">Locations where the most items were successfully recovered.</p>
        {hotspots.length === 0 ? (
          <EmptyState title="No recoveries yet" />
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {hotspots.map((row) => (
              <BarRow key={row.location_name} label={row.location_name} count={row.recovered_count} max={maxHotspot} tone="bg-signal" />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Categories with highest report frequency</h2>
        {categories.length === 0 ? (
          <EmptyState title="No category data yet" />
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {Object.entries(categoryByName)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([category, count]) => (
                <BarRow key={category} label={category} count={count} max={maxCategory} tone="bg-ink" />
              ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Time periods with the most reports</h2>
        <p className="text-xs text-slate-light">By hour of day (server time), across all reports.</p>
        {timeDistribution.length === 0 ? (
          <EmptyState title="No timing data yet" />
        ) : (
          <div className="mt-3 grid grid-cols-12 items-end gap-1 sm:grid-cols-[repeat(24,minmax(0,1fr))]">
            {Array.from({ length: 24 }, (_, hour) => {
              const row = timeDistribution.find((r) => r.hour_of_day === hour);
              const count = row?.report_count ?? 0;
              const heightPct = Math.max(4, Math.round((count / maxHour) * 100));
              return (
                <div key={hour} className="flex flex-col items-center gap-1">
                  <div className="flex h-20 w-full items-end">
                    <div className="w-full rounded-t bg-signal/70" style={{ height: `${heightPct}%` }} title={`${count} reports`} />
                  </div>
                  <span className="text-[9px] text-slate-light">{hour}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
