import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { NotificationBell } from '../notifications/NotificationBell';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchMyRefoundPlusEntitlement, getRefoundPlusBadgeLevel, isRefoundPlusActive } from '../../lib/refoundPlusService';
import type { RefoundPlusEntitlement } from '../../types/database';
import { GodModeBadge } from '../admin/GodModeBadge';
import { ReFoundPlusBadge } from '../support/ReFoundPlusBadge';
import { useIsCreator } from '../../hooks/useIsCreator';
import { ReFoundAdminBadge } from '../admin/ReFoundAdminBadge';

const ACCENT_RING = {
  DEFAULT: '', TEAL: 'ring-2 ring-teal-400', GREEN: 'ring-2 ring-green-400',
  LIME: 'ring-2 ring-lime-400', CYAN: 'ring-2 ring-cyan-400', BLUE: 'ring-2 ring-blue-400',
  INDIGO: 'ring-2 ring-indigo-400', VIOLET: 'ring-2 ring-violet-400', PURPLE: 'ring-2 ring-purple-400',
  PINK: 'ring-2 ring-pink-400', ROSE: 'ring-2 ring-rose-400', RED: 'ring-2 ring-red-400',
  ORANGE: 'ring-2 ring-orange-400', AMBER: 'ring-2 ring-amber-400', YELLOW: 'ring-2 ring-yellow-400',
} as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
    isActive ? 'bg-ink text-white profile-accent-nav' : 'text-ink hover:bg-black/[0.04]'
  }`;

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { showToast } = useToast();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isCreator, loading: creatorLoading } = useIsCreator();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRefoundPlus, setIsRefoundPlus] = useState(false);
  const [plusEntitlement, setPlusEntitlement] = useState<RefoundPlusEntitlement | null>(null);

  useEffect(() => {
    let active = true;
    if (!user || isCreator || creatorLoading) {
      setIsRefoundPlus(false);
      setPlusEntitlement(null);
      return () => { active = false; };
    }
    void fetchMyRefoundPlusEntitlement(user.id).then(({ entitlement }) => {
      if (active) {
        setPlusEntitlement(entitlement);
        setIsRefoundPlus(isRefoundPlusActive(entitlement));
      }
    });
    return () => { active = false; };
  }, [user, isCreator, creatorLoading]);
  const supporterLevel = getRefoundPlusBadgeLevel(plusEntitlement);

  const handleSignOut = async () => {
    await signOut();
    showToast('Signed out successfully.', 'success');
    setMenuOpen(false);
    navigate('/');
  };

  const initials = (profile?.full_name ?? user?.email ?? '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal text-white">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
              <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 21c4-4.5 7-8.2 7-11.2A7 7 0 0 0 5 9.8C5 12.8 8 16.5 12 21Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          ReFound
        </Link>

        {user && (
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/dashboard" className={navLinkClass} end>
              Dashboard
            </NavLink>
            <NavLink to="/matches" className={navLinkClass}>
              Matches
            </NavLink>
            <NavLink to="/map" className={navLinkClass}>
              Map
            </NavLink>
            <NavLink to="/report" className={navLinkClass}>
              Report an item
            </NavLink>
            {isAdmin && !isCreator && (
              <NavLink to="/admin" className={navLinkClass}>
                Admin
              </NavLink>
            )}
            {isCreator && <NavLink to="/creator" className={navLinkClass}>Creator</NavLink>}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {!creatorLoading && !isCreator && <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-ink hover:bg-black/[0.04]"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.7 8.7 0 1 0 20.2 15.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
            )}
          </button>}
          {user && <NotificationBell />}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-border bg-white px-2 py-1.5 pr-3 hover:bg-black/[0.02]"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <ProfileAvatar path={profile?.avatar_url ?? null} initials={initials} className={`h-7 w-7 ${!isCreator && isRefoundPlus ? ACCENT_RING[profile?.profile_accent ?? 'DEFAULT'] : ''}`} />
                <span className="hidden text-sm font-medium sm:inline">
                  {profile?.full_name?.split(' ')[0] ?? 'Account'}
                </span>
                {!creatorLoading && isCreator && <GodModeBadge style="PRISM" className="creator-insignia-badge h-8 w-8 shrink-0" />}
                {!creatorLoading && isAdmin && !isCreator && <ReFoundAdminBadge style={profile?.supporter_badge_style} className="h-8 w-8 shrink-0" />}
                {!adminLoading && !isAdmin && isRefoundPlus && <ReFoundPlusBadge style={profile?.supporter_badge_style} level={supporterLevel.label} className="h-8 w-8 shrink-0 drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]" />}
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-[60] mt-2 w-48 rounded-xl border border-border bg-white py-1 shadow-card-hover"
                >
                  <Link
                    to="/dashboard"
                    className="block px-4 py-2 text-sm text-ink hover:bg-black/[0.03] sm:hidden"
                    onClick={() => setMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/matches"
                    className="block px-4 py-2 text-sm text-ink hover:bg-black/[0.03] sm:hidden"
                    onClick={() => setMenuOpen(false)}
                  >
                    Matches
                  </Link>
                  <Link
                    to="/map"
                    className="block px-4 py-2 text-sm text-ink hover:bg-black/[0.03] sm:hidden"
                    onClick={() => setMenuOpen(false)}
                  >
                    Map
                  </Link>
                  <Link
                    to="/report"
                    className="block px-4 py-2 text-sm text-ink hover:bg-black/[0.03] sm:hidden"
                    onClick={() => setMenuOpen(false)}
                  >
                    Report an item
                  </Link>
                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-sm text-ink hover:bg-black/[0.03]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  {!isCreator && <Link
                    to="/walkthrough"
                    className="block px-4 py-2 text-sm text-ink hover:bg-black/[0.03]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Walkthrough
                  </Link>}
                  {!creatorLoading && !isCreator && <Link
                    to="/support"
                    className="block px-4 py-2 text-sm font-semibold text-signal hover:bg-signal/5"
                    onClick={() => setMenuOpen(false)}
                  >
                    ✦ Support ReFound
                  </Link>}
                  <Link
                    to="/notifications"
                    className="block px-4 py-2 text-sm text-ink hover:bg-black/[0.03] sm:hidden"
                    onClick={() => setMenuOpen(false)}
                  >
                    Notifications
                  </Link>
                  {isAdmin && !isCreator && (
                    <Link
                      to="/admin"
                      className="block px-4 py-2 text-sm text-ink hover:bg-black/[0.03] sm:hidden"
                      onClick={() => setMenuOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                  {isCreator && <Link to="/creator" className="block px-4 py-2 text-sm text-ink hover:bg-black/[0.03] sm:hidden" onClick={() => setMenuOpen(false)}>Zephyrath’s Playground</Link>}
                  <button
                    onClick={handleSignOut}
                    className="block w-full px-4 py-2 text-left text-sm text-coral-dark hover:bg-coral/5"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-black/[0.04]"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-signal px-3 py-2 text-sm font-semibold text-white hover:bg-signal-dark"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
