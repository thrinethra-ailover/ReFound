import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { checkIsCreator } from '../lib/adminService';

/** Server-verified owner identity; no owner email or flag is shipped to the browser. */
export function useIsCreator() {
  const { user } = useAuth();
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    if (!user) { setIsCreator(false); setLoading(false); return; }
    setLoading(true);
    void checkIsCreator().then((result) => {
      if (!cancelled) { setIsCreator(result); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [user]);
  return { isCreator, loading };
}
