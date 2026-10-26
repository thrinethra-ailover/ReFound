import { Link, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useIsCreator } from '../hooks/useIsCreator';
import { fetchMyRefoundPlusEntitlement, isRefoundPlusActive } from '../lib/refoundPlusService';

const steps = [
  {
    number: '01',
    title: 'Create a clear report',
    body: 'Choose Lost or Found, add a useful title and category, describe visible details, and enter an approximate place and time. For a found item, keep a few distinctive facts private so the owner can use them during verification.',
  },
  {
    number: '02',
    title: 'Look for a possible match',
    body: 'Open Matches to review reports ReFound considers similar. You can also browse the Map, filter reports, save a search, and receive an in-app alert when new reports fit that search.',
  },
  {
    number: '03',
    title: 'Verify ownership carefully',
    body: 'The person claiming a found item answers the private questions. The finder reviews the answers and decides whether they are convincing. Matching and verification help with a decision, but neither proves ownership by itself.',
  },
  {
    number: '04',
    title: 'Arrange and confirm a return',
    body: 'If the finder accepts the claim, use the recovery conversation to agree on a safe handoff time and place. Inspect the item and use your judgment before completing the return. Update the report when recovery is complete.',
  },
  {
    number: '05',
    title: 'Keep track of updates',
    body: 'Use the notification bell or the Notifications page for matches, messages, verification updates, and recovery activity. Your Profile contains account settings, notification preferences, and photo controls.',
  },
];

export function WalkthroughPage() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isCreator } = useIsCreator();
  const [isPlus, setIsPlus] = useState(false);
  useEffect(() => {
    let active = true;
    if (!user || isCreator) { setIsPlus(false); return () => { active = false; }; }
    void fetchMyRefoundPlusEntitlement(user.id).then(({ entitlement }) => { if (active) setIsPlus(isRefoundPlusActive(entitlement)); });
    return () => { active = false; };
  }, [user, isCreator]);
  if (isCreator) return <Navigate to="/creator" replace />;
  const staffSteps = [
    { number: '01', title: 'Review reports', body: 'Use the Admin console to browse reports and resolve or deactivate reports that need moderation. Private ownership answers are visible only in the Creator console.' },
    { number: '02', title: 'Handle flags and campus access', body: 'Review user flags, adjust campus verification settings, and use aggregate activity views to understand how the recovery network is working.' },
    { number: '03', title: 'Reply to support messages', body: 'Open Support chat to read and answer user threads. Admins and the Creator share the inbox; the Creator controls ReFound+ setup and Admin access.' },
  ];
  const plusSteps = [
    { number: '06', title: 'Personalize ReFound+', body: 'Set your profile accent, choose available visual effects and cursor styles, use expanded saved searches, and review your private impact recap.' },
    { number: '07', title: 'Manage your membership', body: 'Check your ReFound+ status, payment requests, one-time trial eligibility, and current perks from Support ReFound.' },
  ];
  const pageSteps = isAdmin ? [...staffSteps, ...(isPlus ? plusSteps : [])] : isPlus ? [...steps, ...plusSteps] : steps;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-signal">{isAdmin ? 'Admin guide' : isPlus ? 'ReFound+ guide' : 'ReFound guide'}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">{isAdmin ? 'A walkthrough for ReFound Admins' : isPlus ? 'Your ReFound+ walkthrough' : 'A quick walkthrough'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate">{isAdmin ? 'A guide to the moderation and campus tools available to delegated ReFound Admins.' : 'Use this guide whenever you need a reminder.'}</p>
      </header>

      <div className="mt-8 grid gap-4">
        {pageSteps.map((step) => (
          <section key={step.number} className="flex gap-4 rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-beacon/15 font-mono text-sm font-bold text-beacon-dark">{step.number}</span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">{step.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate">{step.body}</p>
            </div>
          </section>
        ))}
      </div>

      {isPlus && <section className="mt-8 rounded-2xl border border-beacon/25 bg-beacon/10 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-ink">ReFound+ extras</h2>
        <p className="mt-2 text-sm leading-6 text-slate">ReFound+ members can personalize their accent and eligible visual effects, and view their recovery impact recap. Admins keep the ReFound Admin badge and banner instead of supporter cosmetics. Eligible accounts can claim a one-time, 24-hour trial or manage payments from the <Link to="/support" className="font-semibold text-signal underline underline-offset-2">Support ReFound</Link> page.</p>
      </section>}

      <p className="mt-6 text-sm text-slate">Still stuck? Use the in-app support chat when it is enabled, or <Link to="/support" className="font-semibold text-signal underline underline-offset-2">visit Support ReFound</Link>.</p>
    </div>
  );
}
