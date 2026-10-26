import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useIsCreator } from '../../hooks/useIsCreator';
import { Spinner } from '../ui/Spinner';

export function CreatorRoute() {
  const { user, loading: authLoading } = useAuth();
  const { isCreator, loading: creatorLoading } = useIsCreator();
  const location = useLocation();
  if (authLoading || creatorLoading) return <Spinner label="Checking access…" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isCreator) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
