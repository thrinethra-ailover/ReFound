import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { Spinner } from '../ui/Spinner';
import { useIsCreator } from '../../hooks/useIsCreator';

/**
 * This route guard is a convenience layer only — it hides admin navigation
 * and avoids wasted round-trips for non-admins. It is NOT the security
 * boundary: every admin RPC and admin-only RLS policy independently checks
 * is_admin() server-side, so even a user who bypassed this component (e.g.
 * by editing client code) could not read or write anything admin-only.
 */
export function AdminRoute() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isCreator, loading: creatorLoading } = useIsCreator();
  const location = useLocation();

  if (authLoading || adminLoading || creatorLoading) {
    return <Spinner label="Checking access…" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isCreator) return <Navigate to="/creator" replace />;

  return <Outlet />;
}
