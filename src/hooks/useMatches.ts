import { useCallback, useEffect, useState } from 'react';
import { fetchMyMatches, runMatchingForItem } from '../lib/matchService';
import { supabase } from '../lib/supabase';
import type { Item, ItemMatchWithItems } from '../types/database';

export function useMatches(userId: string | undefined) {
  const [matches, setMatches] = useState<ItemMatchWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { matches: data, error: fetchError } = await fetchMyMatches();
    setMatches(data);
    setError(fetchError);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Re-runs the matching engine for all of the user's own active reports. */
  const recompute = async () => {
    if (!userId) return { matchesFound: 0 };
    setRecomputing(true);
    const { data: myItems } = await supabase
      .from('items')
      .select('*')
      .eq('reporter_id', userId)
      .eq('status', 'ACTIVE');

    let total = 0;
    for (const item of (myItems ?? []) as Item[]) {
      const result = await runMatchingForItem(item);
      total += result.matchesFound;
    }
    await refresh();
    setRecomputing(false);
    return { matchesFound: total };
  };

  return { matches, loading, error, recomputing, refresh, recompute };
}
