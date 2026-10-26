import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useIsCreator } from '../../hooks/useIsCreator';
import { fetchMyRefoundPlusEntitlement, isRefoundPlusActive } from '../../lib/refoundPlusService';

/** Applies a Plus member's selected accent to shared app surfaces. */
export function ProfileAccentController() {
  const { user, profile } = useAuth();
  const { isCreator, loading: adminLoading } = useIsCreator();

  useEffect(() => {
    let active = true;
    const root = document.documentElement;
    root.removeAttribute('data-profile-accent');

    if (!user || !profile || !profile.profile_accent || profile.profile_accent === 'DEFAULT' || isCreator || adminLoading) {
      return () => { active = false; };
    }

    void fetchMyRefoundPlusEntitlement(user.id).then(({ entitlement }) => {
      if (active && isRefoundPlusActive(entitlement)) {
        root.dataset.profileAccent = profile.profile_accent;
      }
    });

    return () => {
      active = false;
      root.removeAttribute('data-profile-accent');
    };
  }, [user, profile?.profile_accent, isCreator, adminLoading]);

  return null;
}
