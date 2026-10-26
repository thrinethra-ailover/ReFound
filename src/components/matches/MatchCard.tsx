import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ConfidenceMeter } from './ConfidenceMeter';
import { MatchItemSummary } from './MatchItemSummary';
import { VerificationPanel } from './VerificationPanel';
import { RecoveryTimeline } from './RecoveryTimeline';
import { MessageThread } from './MessageThread';
import { HandoffScheduler } from './HandoffScheduler';
import {
  advanceRecovery,
  rejectMatch,
  requestMatchVerification,
  scheduleHandoff,
} from '../../lib/matchService';
import { classifySpatialCompatibility } from '../../lib/matching';
import { useToast } from '../../hooks/useToast';
import { formatDateTime } from '../../utils/date';
import type { ItemMatchWithItems, MatchStatus } from '../../types/database';

interface MatchCardProps {
  match: ItemMatchWithItems;
  currentUserId: string;
  onChanged: () => void;
}

const STATUS_LABEL: Record<MatchStatus, string> = {
  POTENTIAL_MATCH: 'Potential match',
  VERIFICATION_PENDING: 'Verification in progress',
  VERIFIED: 'Ownership verified',
  REJECTED: 'Not a match',
  RECOVERY_IN_PROGRESS: 'Recovery in progress',
  HANDOFF_SCHEDULED: 'Handoff scheduled',
  RECOVERED: 'Recovered',
};

const STATUS_TONE: Record<MatchStatus, 'signal' | 'beacon' | 'coral' | 'slate'> = {
  POTENTIAL_MATCH: 'beacon',
  VERIFICATION_PENDING: 'beacon',
  VERIFIED: 'signal',
  REJECTED: 'slate',
  RECOVERY_IN_PROGRESS: 'signal',
  HANDOFF_SCHEDULED: 'signal',
  RECOVERED: 'signal',
};

const SPATIAL_TONE: Record<string, string> = {
  High: 'text-signal-dark',
  Medium: 'text-beacon-dark',
  Low: 'text-slate',
  Unknown: 'text-slate-light',
};

function formatDistance(distanceMeters: number | null): string {
  if (distanceMeters === null) return 'Not shared';
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)}m`;
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function formatTimeDiff(minutes: number | null): string {
  if (minutes === null) return 'Unknown';
  const abs = Math.abs(minutes);
  if (abs < 60) return `${Math.round(abs)} minutes`;
  if (abs < 1440) return `${Math.round(abs / 60)} hours`;
  return `${Math.round(abs / 1440)} day(s)`;
}

export function MatchCard({ match, currentUserId, onChanged }: MatchCardProps) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isClaimant = match.lost.reporter_id === currentUserId;
  const isFinder = match.found.reporter_id === currentUserId;
  const spatialCompatibility = classifySpatialCompatibility(match.distance_meters);
  const canMessage = !['POTENTIAL_MATCH', 'REJECTED'].includes(match.status);

  const handleConfirmFound = async () => {
    setBusy(true);
    const { error } = await requestMatchVerification(match.id);
    setBusy(false);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast('Owner notified — verification started.', 'success');
    onChanged();
  };

  const handleReject = async () => {
    setBusy(true);
    const { error } = await rejectMatch(match.id);
    setBusy(false);
    setRejectOpen(false);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast('Match dismissed.', 'success');
    onChanged();
  };

  const handleAdvanceRecovery = async (status: 'RECOVERY_IN_PROGRESS' | 'RECOVERED') => {
    setBusy(true);
    const { error } = await advanceRecovery(match.id, status);
    setBusy(false);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast(status === 'RECOVERED' ? 'Marked as recovered!' : 'Recovery started.', 'success');
    onChanged();
  };

  const handleScheduleHandoff = async (scheduledAtIso: string, location: string) => {
    setBusy(true);
    const { error } = await scheduleHandoff(match.id, scheduledAtIso, location);
    setBusy(false);
    if (error) {
      showToast(error, 'error');
      return;
    }
    setHandoffOpen(false);
    showToast('Handoff proposed.', 'success');
    onChanged();
  };

  return (
    <article className="flex flex-col gap-4 rounded-card border border-border bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={STATUS_TONE[match.status]}>{STATUS_LABEL[match.status]}</Badge>
        <span className="font-mono text-xs text-slate-light">
          {new Date(match.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MatchItemSummary item={match.lost} role="LOST" />
        <MatchItemSummary item={match.found} role="FOUND" />
      </div>

      <ConfidenceMeter score={match.score} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate">Why this might be a match</p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {match.reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-1.5 text-sm text-slate">
              <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-slate-light" />
              {reason}
            </li>
          ))}
        </ul>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-border bg-paper/60 p-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-light">Distance</p>
            <p className="text-sm font-semibold text-ink">{formatDistance(match.distance_meters)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-light">Time difference</p>
            <p className="text-sm font-semibold text-ink">{formatTimeDiff(match.time_difference_minutes)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-light">Spatial compatibility</p>
            <p className={`text-sm font-semibold ${SPATIAL_TONE[spatialCompatibility]}`}>{spatialCompatibility}</p>
          </div>
        </div>

        {match.distance_meters !== null && (
          <Link
            to={`/map?focus=${match.lost_item_id},${match.found_item_id}`}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-signal hover:text-signal-dark"
          >
            View locations on map
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {match.status === 'POTENTIAL_MATCH' && isFinder && (
          <Button size="sm" onClick={handleConfirmFound} loading={busy}>
            I found this item
          </Button>
        )}
        {match.status === 'POTENTIAL_MATCH' && isClaimant && (
          <span className="text-sm text-slate">Waiting for the finder to confirm.</span>
        )}
        {match.status === 'VERIFICATION_PENDING' && (
          <Button size="sm" onClick={() => setVerifyOpen(true)}>
            {isClaimant ? 'Answer ownership questions' : 'Review claimant answers'}
          </Button>
        )}
        {(match.status === 'POTENTIAL_MATCH' || match.status === 'VERIFICATION_PENDING') && (
          <Button size="sm" variant="ghost" onClick={() => setRejectOpen(true)} disabled={busy}>
            Not a match
          </Button>
        )}
        {match.status === 'VERIFIED' && (
          <Button size="sm" onClick={() => handleAdvanceRecovery('RECOVERY_IN_PROGRESS')} loading={busy}>
            Start recovery handoff
          </Button>
        )}
        {match.status === 'RECOVERY_IN_PROGRESS' && (
          <>
            <Button size="sm" onClick={() => setHandoffOpen(true)} loading={busy}>
              Propose handoff time & place
            </Button>
            {isClaimant ? (
              <Button size="sm" variant="secondary" onClick={() => handleAdvanceRecovery('RECOVERED')} loading={busy}>
                Confirm item received
              </Button>
            ) : (
              <span className="text-sm text-slate">The owner confirms when they receive the item.</span>
            )}
          </>
        )}
        {match.status === 'HANDOFF_SCHEDULED' && (
          isClaimant ? (
            <Button size="sm" onClick={() => handleAdvanceRecovery('RECOVERED')} loading={busy}>
              Confirm item received
            </Button>
          ) : (
            <span className="text-sm text-slate">Waiting for the owner to confirm receipt.</span>
          )
        )}
        {match.status === 'RECOVERED' && (
          <span className="text-sm font-medium text-signal-dark">This item has been recovered. 🎉</span>
        )}
        {match.status === 'REJECTED' && (
          <span className="text-sm text-slate">This match was marked as incorrect.</span>
        )}
        {!['POTENTIAL_MATCH', 'REJECTED'].includes(match.status) && (
          <Button size="sm" variant="ghost" onClick={() => setDetailsOpen((v) => !v)}>
            {detailsOpen ? 'Hide timeline & messages' : 'Timeline & messages'}
          </Button>
        )}
      </div>

      {match.status === 'HANDOFF_SCHEDULED' && match.handoff_scheduled_at && (
        <div className="rounded-lg border border-signal/30 bg-signal/5 px-3 py-2 text-sm text-signal-dark">
          Handoff proposed for {formatDateTime(match.handoff_scheduled_at)}
          {match.handoff_location ? ` at ${match.handoff_location}` : ''}.
        </div>
      )}

      {detailsOpen && (
        <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <RecoveryTimeline matchId={match.id} itemReportedAt={match.lost.created_at} />
          <MessageThread matchId={match.id} currentUserId={currentUserId} canSend={canMessage} />
        </div>
      )}

      <Modal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        title={isClaimant ? 'Prove item ownership' : 'Review ownership answers'}
        footer={
          <Button variant="ghost" onClick={() => setVerifyOpen(false)}>
            Close
          </Button>
        }
      >
        <VerificationPanel
          matchId={match.id}
          role={isClaimant ? 'CLAIMANT' : 'FINDER'}
          onDecided={() => {
            setVerifyOpen(false);
            onChanged();
          }}
        />
      </Modal>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Mark as not a match?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleReject} loading={busy}>
              Not a match
            </Button>
          </>
        }
      >
        This tells the other party this pairing isn&rsquo;t correct. It won&rsquo;t be suggested again.
      </Modal>

      <Modal open={handoffOpen} onClose={() => setHandoffOpen(false)} title="Propose a handoff">
        <HandoffScheduler
          onSchedule={handleScheduleHandoff}
          onCancel={() => setHandoffOpen(false)}
          busy={busy}
        />
      </Modal>
    </article>
  );
}
