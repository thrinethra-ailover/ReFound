import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { MatchCard } from '../components/matches/MatchCard';
import { useAuth } from '../hooks/useAuth';
import { useMatches } from '../hooks/useMatches';
import { useToast } from '../hooks/useToast';
import type { MatchStatus } from '../types/database';

type FilterTab = 'ACTIVE' | 'VERIFICATION' | 'RESOLVED';

const ACTIVE_STATUSES: MatchStatus[] = ['POTENTIAL_MATCH'];
const VERIFICATION_STATUSES: MatchStatus[] = ['VERIFICATION_PENDING'];
const RESOLVED_STATUSES: MatchStatus[] = [
  'VERIFIED',
  'REJECTED',
  'RECOVERY_IN_PROGRESS',
  'HANDOFF_SCHEDULED',
  'RECOVERED',
];

export function MatchesPage() {
  const { user } = useAuth();
  const { matches, loading, error, recomputing, recompute, refresh } = useMatches(user?.id);
  const { showToast } = useToast();
  const [tab, setTab] = useState<FilterTab>('ACTIVE');

  const filtered = useMemo(() => {
    const statuses =
      tab === 'ACTIVE' ? ACTIVE_STATUSES : tab === 'VERIFICATION' ? VERIFICATION_STATUSES : RESOLVED_STATUSES;
    return matches.filter((m) => statuses.includes(m.status));
  }, [matches, tab]);

  const counts = useMemo(
    () => ({
      ACTIVE: matches.filter((m) => ACTIVE_STATUSES.includes(m.status)).length,
      VERIFICATION: matches.filter((m) => VERIFICATION_STATUSES.includes(m.status)).length,
      RESOLVED: matches.filter((m) => RESOLVED_STATUSES.includes(m.status)).length,
    }),
    [matches]
  );

  const handleRecompute = async () => {
    const { matchesFound } = await recompute();
    showToast(
      matchesFound > 0
        ? `Found ${matchesFound} new potential match${matchesFound === 1 ? '' : 'es'}.`
        : 'No new matches right now.',
      matchesFound > 0 ? 'success' : 'info'
    );
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Potential matches</h1>
          <p className="mt-1 text-sm text-slate">
            Scored by ReFound&rsquo;s deterministic matching engine — never AI-guessed, always
            explainable.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleRecompute} loading={recomputing}>
          Refresh matches
        </Button>
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
        {(['ACTIVE', 'VERIFICATION', 'RESOLVED'] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-ink text-white' : 'bg-white text-ink border border-border hover:bg-black/[0.02]'
            }`}
          >
            {t === 'ACTIVE' ? 'New matches' : t === 'VERIFICATION' ? 'Verifying' : 'Resolved'}{' '}
            <span className="font-mono text-xs opacity-70">{counts[t]}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral-dark" role="alert">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {loading ? (
          <Spinner label="Loading matches…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={tab === 'ACTIVE' ? 'No potential matches yet' : 'Nothing here yet'}
            description="Matches appear automatically when a lost and found report score highly against each other. Only strong and possible matches (60%+) are ever shown."
            action={
              <Link to="/report">
                <Button size="sm">Report an item</Button>
              </Link>
            }
          />
        ) : (
          filtered.map((match) => (
            <MatchCard key={match.id} match={match} currentUserId={user.id} onChanged={refresh} />
          ))
        )}
      </div>
    </div>
  );
}
