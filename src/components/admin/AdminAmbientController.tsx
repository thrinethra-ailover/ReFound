import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useIsCreator } from '../../hooks/useIsCreator';
import { AdminAmbientEffects } from './AdminAmbientEffects';

/** Creator-only visual effects across the whole app. */
export function AdminAmbientController() {
  const { user } = useAuth();
  const { isCreator, loading } = useIsCreator();
  const verifiedCreator = Boolean(user && !loading && isCreator);

  useEffect(() => {
    document.documentElement.classList.toggle('refound-admin-theme', verifiedCreator);
    return () => document.documentElement.classList.remove('refound-admin-theme');
  }, [verifiedCreator]);

  if (!user || loading || !isCreator) return null;

  return <AdminAmbientEffects />;
}
