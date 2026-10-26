import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ProximityAssistSettings } from '../components/profile/ProximityAssistSettings';
import { PushNotificationSettings } from '../components/profile/PushNotificationSettings';
import { EmailNotificationSettings } from '../components/profile/EmailNotificationSettings';
import { NotificationPreferences } from '../components/profile/NotificationPreferences';
import { ProfilePhotoSettings } from '../components/profile/ProfilePhotoSettings';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { fetchMyRefoundPlusEntitlement, getRefoundPlusBadgeLevel, isRefoundPlusActive } from '../lib/refoundPlusService';
import type { RefoundPlusEntitlement } from '../types/database';
import { GodModeBadge } from '../components/admin/GodModeBadge';
import { ReFoundPlusBadge } from '../components/support/ReFoundPlusBadge';
import { PlusPersonalizationSettings } from '../components/profile/PlusPersonalizationSettings';
import { PlusProfileRewardsSettings } from '../components/profile/PlusProfileRewardsSettings';
import { PlusImpactRecap } from '../components/support/PlusImpactRecap';
import { useIsCreator } from '../hooks/useIsCreator';
import { ReFoundAdminBadge } from '../components/admin/ReFoundAdminBadge';

const PROFILE_BANNERS = {
  AURORA: 'linear-gradient(125deg, #10071e 0%, #302052 46%, #164450 100%)',
  CIRCUIT: 'linear-gradient(125deg, #090b18 0%, #23103a 54%, #43142e 100%)',
  NIGHT_SKY: 'linear-gradient(125deg, #071426 0%, #172c55 55%, #35154c 100%)',
  CRYSTAL: 'linear-gradient(125deg, #180c2e 0%, #522c75 52%, #243e72 100%)',
  EMBER: 'linear-gradient(125deg, #260d17 0%, #70272c 52%, #6b3b16 100%)',
} as const;

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isCreator, loading: creatorLoading } = useIsCreator();
  const [plusEntitlement, setPlusEntitlement] = useState<RefoundPlusEntitlement | null>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [profileAccent, setProfileAccent] = useState<NonNullable<typeof profile>['profile_accent']>(profile?.profile_accent ?? 'DEFAULT');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || isCreator || creatorLoading) {
      setPlusEntitlement(null);
      return;
    }
    let active = true;
    void fetchMyRefoundPlusEntitlement(user.id).then(({ entitlement }) => {
      if (active) setPlusEntitlement(entitlement);
    });
    return () => { active = false; };
  }, [user, isCreator, creatorLoading]);

  const plusActive = isRefoundPlusActive(plusEntitlement);
  const showMembershipBadge = !adminLoading && !creatorLoading && (isAdmin || plusActive);
  const badgeLevel = getRefoundPlusBadgeLevel(plusEntitlement);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim()) {
      showToast('Full name cannot be empty.', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setSaving(false);

    if (error) {
      showToast(error.message, 'error');
      return;
    }
    await refreshProfile();
    showToast('Profile updated.', 'success');
  };

  const saveProfileAccent = async (accent: NonNullable<typeof profile>['profile_accent']) => {
    if (!user || !plusActive || isCreator) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ profile_accent: accent, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      showToast(error.message, 'error');
      return false;
    }
    await refreshProfile();
    return true;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Your profile</h1>
      <p className="mt-1 text-sm text-slate">Manage your account details.</p>

      <div className="mt-8 flex flex-col gap-6">
        {showMembershipBadge && (
          <section className={`relative flex min-h-40 items-center justify-between gap-6 overflow-hidden rounded-[1.5rem] border p-6 shadow-card-hover sm:p-8 ${isCreator ? 'admin-profile-insignia-card border-violet-400/30 text-white' : isAdmin ? 'border-white/20 text-white' : 'border-amber-300/40 text-white'}`} style={!isCreator ? { background: PROFILE_BANNERS[profile?.profile_banner ?? 'AURORA'] } : undefined} aria-label={isCreator ? 'The Creator banner' : isAdmin ? 'ReFound Admin banner' : 'ReFound+ supporter badge'}>
            {isCreator && <div className="admin-profile-banner-geometry" aria-hidden="true" />}
            {!isAdmin && <div className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" />}
            <div className="relative z-10">
              <h2 className="font-display text-2xl font-bold sm:text-3xl">{isCreator ? 'The Creator' : isAdmin ? 'ReFound Admin' : 'ReFound+'}</h2>
              <p className="mt-1 max-w-md text-sm text-white/75">{isCreator ? 'The origin of this recovery network, crowned in violet and flame.' : isAdmin ? 'Trusted to help moderate the campus recovery network.' : 'Helping good things find their way back.'}</p>
            </div>
            <div className={`relative z-10 shrink-0 rounded-full border p-3 ${isCreator ? 'creator-insignia-halo border-violet-200/30 bg-black/40' : 'border-white/20 bg-black/20 shadow-[0_0_25px_rgba(255,255,255,0.15)]'}`}>
              {isCreator ? <GodModeBadge style="PRISM" className="creator-insignia-badge h-20 w-20 sm:h-28 sm:w-28" /> : isAdmin ? <ReFoundAdminBadge style={profile?.supporter_badge_style} className="h-20 w-20 sm:h-28 sm:w-28" /> : <ReFoundPlusBadge style={profile?.supporter_badge_style} level={badgeLevel.label} className="h-20 w-20 drop-shadow-[0_0_12px_rgba(253,230,138,0.55)] sm:h-28 sm:w-28" />}
            </div>
            {!isAdmin && <span className="absolute bottom-4 left-6 z-10 rounded-full border border-white/20 bg-black/25 px-3 py-1 text-xs font-semibold text-white/90 sm:bottom-5 sm:left-8">{badgeLevel.label}{badgeLevel.days > 0 ? ` · ${badgeLevel.days} days` : ''}</span>}
          </section>
        )}

        <ProfilePhotoSettings />

        {plusActive && !isCreator && user && (
          <PlusPersonalizationSettings
            userId={user.id}
            profileAccent={profileAccent}
            onProfileAccentChange={setProfileAccent}
            onSaveProfileAccent={saveProfileAccent}
            canEditAccent
          />
        )}

        {!adminLoading && !creatorLoading && user && (isAdmin ? plusActive : plusActive || profile?.supporter_recognition_enabled) && (
          <PlusProfileRewardsSettings
            userId={user.id}
            profile={profile}
            isAdmin={isAdmin}
            plusActive={plusActive}
            onSaved={refreshProfile}
          />
        )}

        {!adminLoading && user && (isCreator || plusActive) && <PlusImpactRecap />}

        <form onSubmit={handleSave} className="profile-settings-form flex flex-col gap-4 rounded-card border border-border bg-white p-6 shadow-card sm:p-8">
          <Input label="Email" value={user?.email ?? ''} disabled hint="Email cannot be changed here yet." />
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Button type="submit" loading={saving} className="self-start">
            Save changes
          </Button>
        </form>

        <div className="flex flex-col gap-6">
          <NotificationPreferences />
          <ProximityAssistSettings />
          <PushNotificationSettings />
          <EmailNotificationSettings />
        </div>
      </div>
    </div>
  );
}
