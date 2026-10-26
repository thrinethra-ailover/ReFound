import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { useToast } from '../../hooks/useToast';
import { createSavedSearch, deleteSavedSearch, fetchSavedSearches, type SavedSearch } from '../../lib/communityService';
import type { RefoundPlusEntitlement, ReportType } from '../../types/database';
import { useIsCreator } from '../../hooks/useIsCreator';
import { fetchMyRefoundPlusEntitlement, isRefoundPlusActive } from '../../lib/refoundPlusService';

interface Props {
  userId: string;
  keyword: string;
  reportType: ReportType | 'ALL';
  category: string;
  location: string;
}

export function SavedSearchesPanel({ userId, keyword, reportType, category, location }: Props) {
  const { showToast } = useToast();
  const { isCreator } = useIsCreator();
  const [entitlement, setEntitlement] = useState<RefoundPlusEntitlement | null>(null);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const { searches: rows, error } = await fetchSavedSearches();
    setSearches(rows);
    if (error) showToast(error, 'error');
    setLoading(false);
  }, [showToast]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { let active = true; void fetchMyRefoundPlusEntitlement(userId).then(({ entitlement: value }) => { if (active) setEntitlement(value); }); return () => { active = false; }; }, [userId]);

  const hasCriteria = Boolean(keyword.trim() || category || location.trim() || reportType !== 'ALL');
  const plusActive = isCreator || isRefoundPlusActive(entitlement);
  const saveLimitReached = !plusActive && searches.length >= 5;
  const save = async () => {
    if (!hasCriteria) return;
    const pieces = [keyword.trim(), category, location.trim(), reportType === 'ALL' ? '' : reportType.toLowerCase()]
      .filter(Boolean);
    setSaving(true);
    const { error } = await createSavedSearch({
      user_id: userId,
      label: pieces.join(' · ').slice(0, 80),
      keyword: keyword.trim() || null,
      report_type: reportType,
      category: category || null,
      location: location.trim() || null,
    });
    setSaving(false);
    if (error) showToast(error, 'error');
    else { showToast('Saved search added. You’ll get an in-app alert for new matches.', 'success'); await refresh(); }
  };

  const remove = async (id: string) => {
    const { error } = await deleteSavedSearch(id);
    if (error) showToast(error, 'error');
    else setSearches((rows) => rows.filter((row) => row.id !== id));
  };

  return (
    <section className="rounded-xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Saved searches & alerts {plusActive ? <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Unlimited</span> : <span className="ml-1 text-xs font-normal text-slate">{searches.length}/5 free</span>}</h2>
          <p className="mt-0.5 text-xs text-slate">Get an in-app notification for new matches. Date filters affect this view; alerts use keyword, type, category, and location.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void save()} disabled={!hasCriteria || saveLimitReached} loading={saving}>Save these filters</Button>
      </div>
      {saveLimitReached && <p className="mt-3 text-xs text-slate">You’ve reached the five-search free limit. <a href="/support" className="font-semibold text-signal-dark underline">ReFound+ includes unlimited saved searches.</a> Your existing searches remain available.</p>}
      {loading ? <p className="mt-3 text-xs text-slate">Loading saved searches…</p> : searches.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {searches.map((search) => <li key={search.id} className="flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-xs text-ink">
            <span>{search.label}</span>
            <button type="button" onClick={() => void remove(search.id)} aria-label={`Remove saved search ${search.label}`} className="font-bold text-slate hover:text-coral-dark">×</button>
          </li>)}
        </ul>
      ) : <p className="mt-3 text-xs text-slate">No saved searches yet. Choose filters and save them to get alerts.</p>}
    </section>
  );
}
