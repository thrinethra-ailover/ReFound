import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Spinner } from '../ui/Spinner';
import { fetchMyCampusVerificationStatus } from '../../lib/adminService';
import { Button } from '../ui/Button';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [campusAllowed, setCampusAllowed] = useState<boolean | null>(null);
  const [campusError, setCampusError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) {
      setCampusAllowed(null);
      setCampusError(false);
      return;
    }
    setCampusAllowed(null);
    setCampusError(false);
    fetchMyCampusVerificationStatus().then(({ status, error }) => {
      if (!active) return;
      if (error || !status) setCampusError(true);
      else setCampusAllowed(!status.enabled || status.verified);
    });
    return () => { active = false; };
  }, [user?.id]);

  if (loading) {
    return <Spinner label="Checking your session…" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (campusError) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-xl font-bold text-ink">Couldn&rsquo;t check campus access</h1>
      <p className="mt-2 text-sm text-slate">Try again in a moment. Your account data is safe.</p>
      <Button className="mt-5" onClick={() => { setCampusAllowed(null); setCampusError(false); fetchMyCampusVerificationStatus().then(({ status, error }) => error || !status ? setCampusError(true) : setCampusAllowed(!status.enabled || status.verified)); }}>Try again</Button>
    </div>;
  }

  if (campusAllowed === null) return <Spinner label="Checking campus access…" />;
  if (!campusAllowed) return <Navigate to="/verify-campus" state={{ from: location }} replace />;

  return <Outlet />;
}
