import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CampusMap, type MapMarkerItemWithCoords, type ProximityZone } from '../components/map/CampusMap';
import { MapItemDetail } from '../components/map/MapItemDetail';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { TextArea } from '../components/ui/TextArea';
import { SavedSearchesPanel } from '../components/items/SavedSearchesPanel';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useGeolocation } from '../hooks/useGeolocation';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { haversineDistanceMeters } from '../lib/matching';
import { DEFAULT_PROXIMITY_RADIUS } from '../lib/proximity';
import { ITEM_CATEGORIES } from '../utils/constants';
import { flagReport } from '../lib/communityService';
import { formatRelativeDate } from '../utils/date';
import type { ItemWithImages } from '../types/database';

type FilterTab = 'ALL' | 'LOST' | 'FOUND' | 'NEARBY' | 'RECENT';

const RECENT_WINDOW_HOURS = 48;

function mergeItems(existing: ItemWithImages[], incoming: ItemWithImages[]) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return [...byId.values()];
}

const GEO_STATUS_COPY: Record<string, string> = {
  requesting: 'Locating you\u2026',
  denied: 'Location permission denied — showing all items instead.',
  unavailable: 'Could not determine your location.',
  timeout: 'Locating you took too long.',
  unsupported: 'Geolocation is not supported in this browser.',
  error: 'Something went wrong getting your location.',
};

export function MapPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const geo = useGeolocation(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<ItemWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('ALL');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [flagTarget, setFlagTarget] = useState<ItemWithImages | null>(null);
  const [flagReason, setFlagReason] = useState('SPAM');
  const [flagDetails, setFlagDetails] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [visibleResultCount, setVisibleResultCount] = useState(20);

  const focusIds = useMemo(() => {
    const raw = searchParams.get('focus');
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const collected: ItemWithImages[] = [];
      const pageSize = 500;
      let error: { message: string } | null = null;
      for (let offset = 0; ; offset += pageSize) {
        const result = await supabase.from('items').select('*, item_images(*)').eq('status', 'ACTIVE')
          .order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
        if (result.error) { error = result.error; break; }
        collected.push(...((result.data ?? []) as ItemWithImages[]));
        if ((result.data?.length ?? 0) < pageSize) break;
      }

      if (cancelled) return;
      if (error) {
        showToast(error.message, 'error');
        setItems([]);
      } else {
        setItems((current) => mergeItems(current, collected));
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusIds.length) return;
    let cancelled = false;
    supabase.from('items').select('*, item_images(*)').eq('status', 'ACTIVE').in('id', focusIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) showToast(error.message, 'error');
        else setItems((current) => mergeItems(current, (data ?? []) as ItemWithImages[]));
      });
    return () => { cancelled = true; };
  }, [focusIds, showToast]);

  useEffect(() => {
    if (focusIds.length > 0) {
      setSelectedItemId(focusIds[0]);
    }
  }, [focusIds]);

  const filtered = useMemo(() => {
    if (focusIds.length > 0) {
      return items.filter((item) => focusIds.includes(item.id));
    }

    let result = items;
    switch (tab) {
      case 'LOST':
        result = result.filter((item) => item.report_type === 'LOST');
        break;
      case 'FOUND':
        result = result.filter((item) => item.report_type === 'FOUND');
        break;
      case 'RECENT': {
        const cutoff = Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000;
        result = result.filter((item) => new Date(item.created_at).getTime() >= cutoff);
        break;
      }
      case 'NEARBY': {
        if (!geo.position) break;
        result = result.filter(
          (item) =>
            item.latitude !== null &&
            item.longitude !== null &&
            haversineDistanceMeters(geo.position!.latitude, geo.position!.longitude, item.latitude, item.longitude) <=
              DEFAULT_PROXIMITY_RADIUS * 5 // a generous browsing radius, distinct from the alert radius
        );
        break;
      }
    }
    const needle = query.trim().toLowerCase();
    if (needle) result = result.filter((item) => [item.title, item.description, item.category, item.location_name].some((value) => value?.toLowerCase().includes(needle)));
    if (category) result = result.filter((item) => item.category === category);
    const locationNeedle = locationFilter.trim().toLowerCase();
    if (locationNeedle) result = result.filter((item) => item.location_name?.toLowerCase().includes(locationNeedle));
    if (dateFrom) result = result.filter((item) => item.item_datetime.slice(0, 10) >= dateFrom);
    if (dateTo) result = result.filter((item) => item.item_datetime.slice(0, 10) <= dateTo);
    return result;
  }, [items, tab, geo.position, focusIds, query, category, locationFilter, dateFrom, dateTo]);

  const markerItems: MapMarkerItemWithCoords[] = filtered
    .filter((item) => item.latitude !== null && item.longitude !== null)
    .map((item) => ({
      id: item.id,
      reportType: item.report_type,
      category: item.category,
      title: item.title,
      locationName: item.location_name,
      createdAt: item.created_at,
      latitude: item.latitude as number,
      longitude: item.longitude as number,
    }));

  const proximityZones: ProximityZone[] = filtered
    .filter((item) => item.report_type === 'LOST' && item.latitude !== null && item.longitude !== null)
    .map((item) => ({
      id: item.id,
      latitude: item.latitude as number,
      longitude: item.longitude as number,
      radiusMeters: DEFAULT_PROXIMITY_RADIUS,
    }));

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

  const handleUseLocation = () => {
    geo.request();
  };

  const clearFocus = () => {
    setSearchParams({});
  };

  const submitFlag = async () => {
    if (!user || !flagTarget) return;
    setFlagging(true);
    const { error } = await flagReport({ itemId: flagTarget.id, reporterId: user.id, reason: flagReason, details: flagDetails });
    setFlagging(false);
    if (error) showToast(error.includes('duplicate') ? 'You have already reported this listing.' : error, 'error');
    else {
      showToast('Thanks. The listing was sent to admins for review.', 'success');
      setFlagTarget(null);
      setFlagDetails('');
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Campus map</h1>
          <p className="mt-1 text-sm text-slate">
            Marker positions are approximate — never the exact reported spot.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleUseLocation} loading={geo.status === 'requesting'}>
          Use my location
        </Button>
      </div>

      {geo.status !== 'idle' && geo.status !== 'granted' && geo.errorMessage && (
        <p className="mt-2 text-xs text-coral-dark">{GEO_STATUS_COPY[geo.status] ?? geo.errorMessage}</p>
      )}

      {focusIds.length > 0 ? (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-signal/30 bg-signal/5 px-4 py-2.5 text-sm text-signal-dark">
          <span>Showing items from your match.</span>
          <button onClick={clearFocus} className="font-medium underline hover:no-underline">
            Show all items
          </button>
        </div>
      ) : (
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {(['ALL', 'LOST', 'FOUND', 'NEARBY', 'RECENT'] as FilterTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? 'bg-ink text-white' : 'bg-white text-ink border border-border hover:bg-black/[0.02]'
              }`}
            >
              {t === 'ALL'
                ? 'All'
                : t === 'NEARBY'
                  ? 'Nearby'
                  : t === 'RECENT'
                    ? 'Recently reported'
                    : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      )}

      {!focusIds.length && <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input label="Search reports" placeholder="Item, description, or place" value={query} onChange={(event) => setQuery(event.target.value)} />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">Category
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm">
            <option value="">All categories</option>{ITEM_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </label>
        <Input label="Location" placeholder="Filter by place" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} />
        <Input label="From date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <Input label="To date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
      </div>}

      {!focusIds.length && <div className="mt-4"><SavedSearchesPanel userId={user.id} keyword={query} reportType={tab === 'LOST' || tab === 'FOUND' ? tab : 'ALL'} category={category} location={locationFilter} /></div>}

      {loading ? (
        <Spinner label="Loading map…" />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <CampusMap
            items={markerItems}
            userPosition={geo.position}
            proximityZones={proximityZones}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            heightPx={520}
          />
          <MapItemDetail item={selectedItem} onClose={() => setSelectedItemId(null)} canFlag={Boolean(selectedItem && selectedItem.reporter_id !== user.id)} onFlag={() => selectedItem && setFlagTarget(selectedItem)} />
        </div>
      )}

      {!loading && <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">Matching reports <span className="font-sans text-sm font-normal text-slate">({filtered.length})</span></h2>
        {filtered.length ? <>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-white">
            {filtered.slice(0, visibleResultCount).map((item) => <li key={item.id}>
              <button type="button" onClick={() => setSelectedItemId(item.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-paper/70">
                <span><span className={`mr-2 text-xs font-bold ${item.report_type === 'LOST' ? 'text-signal' : 'text-beacon'}`}>{item.report_type}</span><span className="font-medium text-ink">{item.title}</span><span className="ml-2 text-xs text-slate">{item.category}</span></span>
                <span className="text-xs text-slate">{item.location_name || 'Location not shared'} · {formatRelativeDate(item.item_datetime)}</span>
              </button>
            </li>)}
          </ul>
          {visibleResultCount < filtered.length && <div className="mt-3 text-center"><Button variant="ghost" size="sm" onClick={() => setVisibleResultCount((count) => count + 20)}>Show more reports</Button></div>}
        </> : <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-slate">No reports match these filters. Try removing a filter or save this search for future alerts.</p>}
      </section>}

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-signal" /> Lost item
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-beacon" /> Found item
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" /> Your approximate location
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-coral" /> Proximity zone
        </span>
      </div>

      {markerItems.length === 0 && !loading && (
        <p className="mt-6 text-center text-sm text-slate">
          No items with a shared location match this filter. Not everyone opts in to sharing a
          location, so the map won&rsquo;t show every report. Want to report one?{' '}
          <Link to="/report" className="font-medium text-signal hover:text-signal-dark">
            Report an item
          </Link>
        </p>
      )}

      <Modal open={Boolean(flagTarget)} onClose={() => setFlagTarget(null)} title="Report this listing" footer={<>
        <Button variant="ghost" onClick={() => setFlagTarget(null)}>Cancel</Button>
        <Button onClick={() => void submitFlag()} loading={flagging}>Send to admins</Button>
      </>}>
        <p className="mb-4">Tell admins why <strong>{flagTarget?.title}</strong> should be reviewed. The report owner won&rsquo;t see who flagged it.</p>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">Reason
          <select value={flagReason} onChange={(event) => setFlagReason(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm">
            <option value="SPAM">Spam or fake listing</option><option value="INAPPROPRIATE">Inappropriate content</option><option value="MISLEADING">Misleading details</option><option value="DUPLICATE">Duplicate report</option><option value="OTHER">Other</option>
          </select>
        </label>
        <TextArea className="mt-3" label="Details (optional)" value={flagDetails} onChange={(event) => setFlagDetails(event.target.value)} maxLength={1000} />
      </Modal>
    </div>
  );
}
