import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ItemStatus, ItemWithImages } from '../types/database';
import { runMatchingForItem } from '../lib/matchService';

interface UseMyItemsResult {
  items: ItemWithImages[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateStatus: (itemId: string, status: ItemStatus) => Promise<{ error: string | null }>;
  deleteItem: (itemId: string) => Promise<{ error: string | null }>;
}

/** Loads the current user's own reports (both LOST and FOUND), with their images. */
export function useMyItems(userId: string | undefined): UseMyItemsResult {
  const [items, setItems] = useState<ItemWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('items')
      .select('*, item_images(*)')
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setItems([]);
    } else {
      setItems((data ?? []) as ItemWithImages[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateStatus = async (itemId: string, status: ItemStatus) => {
    const { error: updateError } = await supabase
      .from('items')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'ACTIVE' ? { last_confirmed_active_at: new Date().toISOString(), stale_reminded_at: null } : {}),
      })
      .eq('id', itemId);
    if (updateError) return { error: updateError.message };
    if (status === 'ACTIVE') {
      const item = items.find((row) => row.id === itemId);
      if (item) await runMatchingForItem({ ...item, status: 'ACTIVE' });
    }
    await refresh();
    return { error: null };
  };

  const deleteItem = async (itemId: string) => {
    const { error: deleteError } = await supabase.from('items').delete().eq('id', itemId);
    if (deleteError) return { error: deleteError.message };
    await refresh();
    return { error: null };
  };

  return { items, loading, error, refresh, updateStatus, deleteItem };
}
