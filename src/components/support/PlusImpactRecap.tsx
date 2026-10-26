import { useEffect, useState } from 'react';
import { fetchMyRefoundPlusImpact, type ReFoundPlusImpact } from '../../lib/refoundPlusService';

export function PlusImpactRecap() {
  const [impact, setImpact] = useState<ReFoundPlusImpact | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMyRefoundPlusImpact().then((result) => {
      if (!active) return;
      setImpact(result.impact);
      setError(result.error);
    });
    return () => { active = false; };
  }, []);

  return <section className="rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8" aria-label="Private ReFound+ impact recap">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-ink">Your private impact recap</h2><p className="mt-1 text-sm text-slate">Only you can see these all-time contribution counts.</p></div><span className="rounded-full bg-signal/10 px-3 py-1 text-xs font-semibold text-signal-dark">Private to your account</span></div>
    {error ? <p role="alert" className="mt-5 text-sm text-coral-dark">Could not load the impact recap: {error}</p> : impact ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
      ['Reports shared', impact.reports_shared], ['Lost reports', impact.lost_reports], ['Found reports', impact.found_reports], ['Confirmed recoveries', impact.recoveries_confirmed],
    ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-paper p-4"><p className="font-display text-2xl font-bold text-ink">{value}</p><p className="mt-1 text-xs text-slate">{label}</p></div>)}</div> : <p className="mt-5 text-sm text-slate">Loading your private impact recap…</p>}
  </section>;
}
