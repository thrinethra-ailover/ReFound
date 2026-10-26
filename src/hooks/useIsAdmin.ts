import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { checkIsAdmin } from '../lib/adminService';

/**
 * Server-verified admin check — calls the is_admin() RPC rather than trusting
 * any client-stored flag. A user cannot spoof this since admin_users has no
 * client-writable RLS policy at all.
 */
export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    checkIsAdmin().then((result) => {
      if (!cancelled) {
        setIsAdmin(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isAdmin, loading };
}
