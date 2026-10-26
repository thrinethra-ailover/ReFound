import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useIsAdmin } from '../hooks/useIsAdmin';
import {
  createRefoundPlusPaymentRequest,
  cancelRefoundPlusPaymentRequest,
  DEFAULT_REFOUND_PLUS_SETTINGS,
  fetchMyRefoundPlusRequests,
  fetchRefoundPlusSettings,
  fetchMyRefoundPlusEntitlement,
  fetchRefoundPlusSupporters,
  fetchMyRefoundPlusTrialStatus,
  claimRefoundPlusFreeTrial,
  getRefoundPlusBadgeLevel,
  isRefoundPlusActive,
  submitRefoundPlusUtr,
  type RefoundPlusPaymentRequest,
  type RefoundPlusSettings,
  type PublicSupporter,
  type RefoundPlusTrialStatus,
} from '../lib/refoundPlusService';
import type { RefoundPlusEntitlement } from '../types/database';
import { GodModeBadge } from '../components/admin/GodModeBadge';
import { ReFoundPlusBadge } from '../components/support/ReFoundPlusBadge';
import { Button } from '../components/ui/Button';
import { PlusImpactRecap } from '../components/support/PlusImpactRecap';
import { useIsCreator } from '../hooks/useIsCreator';
import { ReFoundAdminBadge } from '../components/admin/ReFoundAdminBadge';

const SUPPORTER_EXTRAS = [
  ['✦', 'Profile accents', 'Choose an optional color accent for primary actions, active navigation, focused controls, and profile surfaces across ReFound. Creator-only effects remain private to the Creator.'],
  ['✧', 'Supporter badge', 'Show your ReFound+ crest on your profile and account menu. The app creator keeps The Creator insignia.'],
  ['⌕', 'Unlimited saved searches', 'Free accounts can save five searches; Plus members can save as many as they need. Existing searches are kept.'],
  ['♡', 'Support campus recovery', 'Your contribution helps with the ongoing costs of keeping this student-built project available.'],
  ['▰', 'Profile banners', 'Dress up the large supporter panel on your profile with a choice of original banner styles.'],
  ['✥', 'Badge styles', 'Choose from colorful ReFound+ crest designs for your profile and account menu.'],
  ['✧', 'Ambience and cursors', 'Add optional animated backgrounds and desktop cursor styles, with settings tuned to your profile accent.'],
  ['↗', 'Private impact recap', 'See your own report and confirmed recovery counts. These personal stats are never shown on the public wall.'],
  ['♡', 'Public thank-you wall', 'Opt in with a display name. Admins appear with their Admin identity; other members show their supporter level. Recognition is optional.'],
  ['✦', 'Tenure badge progression', 'Your supporter crest earns new levels over time: New supporter, Beacon, Guardian, and Legacy.'],
];

function paymentUri(request: RefoundPlusPaymentRequest) {
  if (!request.upi_vpa) return '';
  const params = new URLSearchParams({ pa: request.upi_vpa, pn: request.payee_name, am: String(request.amount_inr), cu: 'INR', tn: 'ReFound Plus' });
  return `upi://pay?${params.toString()}`;
}

export function SupportReFoundPage() {
  const { user, profile } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isCreator, loading: creatorLoading } = useIsCreator();
  const [entitlement, setEntitlement] = useState<RefoundPlusEntitlement | null>(null);
  const [trialStatus, setTrialStatus] = useState<RefoundPlusTrialStatus | null>(null);
  const [settings, setSettings] = useState<RefoundPlusSettings>(DEFAULT_REFOUND_PLUS_SETTINGS);
  const [requests, setRequests] = useState<RefoundPlusPaymentRequest[]>([]);
  const [utr, setUtr] = useState('');
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrBroken, setQrBroken] = useState(false);
  const [supporters, setSupporters] = useState<PublicSupporter[]>([]);
  const [wallLoading, setWallLoading] = useState(true);
  const [wallError, setWallError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setTrialStatus(null); setLoading(false); return; }
    setLoading(true);
    const [settingsResult, entitlementResult, requestsResult, trialResult] = await Promise.all([
      fetchRefoundPlusSettings(), fetchMyRefoundPlusEntitlement(user.id), fetchMyRefoundPlusRequests(), fetchMyRefoundPlusTrialStatus(),
    ]);
    if (settingsResult.settings) setSettings(settingsResult.settings);
    setEntitlement(entitlementResult.entitlement);
    setRequests(requestsResult.requests);
    setTrialStatus(trialResult.status);
    setError(settingsResult.error ?? entitlementResult.error ?? requestsResult.error ?? trialResult.error);
    setLoading(false);
  }, [user, isAdmin]);
  useEffect(() => { void refresh(); }, [refresh]);

  const plusActive = isRefoundPlusActive(entitlement);
  const perksIncluded = isCreator || plusActive;
  const badgeLevel = getRefoundPlusBadgeLevel(entitlement);
  const currentRequest = requests.find((request) => ['AWAITING_PAYMENT', 'PENDING_REVIEW'].includes(request.status));

  useEffect(() => {
    let active = true;
    void fetchRefoundPlusSupporters().then((result) => {
      if (active) {
        setSupporters(result.supporters);
        setWallError(result.error);
      }
    }).finally(() => { if (active) setWallLoading(false); });
    return () => { active = false; };
  }, []);

  const createRequest = async () => {
    setWorking(true); setError(null);
    const result = await createRefoundPlusPaymentRequest();
    setWorking(false);
    if (result.error) setError(result.error); else await refresh();
  };
  const submitUtr = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentRequest) return;
    setWorking(true); setError(null);
    const result = await submitRefoundPlusUtr(currentRequest.id, utr);
    setWorking(false);
    if (result.error) setError(result.error); else { setUtr(''); await refresh(); }
  };
  const cancelRequest = async () => {
    if (!currentRequest) return;
    setWorking(true); setError(null);
    const result = await cancelRefoundPlusPaymentRequest(currentRequest.id);
    setWorking(false);
    if (result.error) setError(result.error); else await refresh();
  };
  const startTrial = async () => {
    setWorking(true); setError(null);
    const result = await claimRefoundPlusFreeTrial();
    setWorking(false);
    if (result.error) setError(result.error); else await refresh();
  };

  const trialMessage = () => {
    if (!trialStatus) return 'Trial availability could not be checked. Refresh this page and try again.';
    if (plusActive) return `Your ReFound+ access is active${trialStatus.ends_at ? ` until ${new Date(trialStatus.ends_at).toLocaleString()}` : ''}.`;
    switch (trialStatus.reason) {
      case 'ALREADY_USED': return `This one-time trial has already been used${trialStatus.ends_at ? ` and ended on ${new Date(trialStatus.ends_at).toLocaleString()}` : ''}.`;
      case 'ACTIVE_MEMBERSHIP': return 'Your ReFound+ membership is already active.';
      case 'PENDING_PAYMENT': return 'Resolve or cancel your pending UPI request before starting a trial.';
      case 'CAMPUS_VERIFICATION_REQUIRED': return 'Complete campus account verification before claiming the trial.';
      case 'ADMIN_INCLUDED': return 'ReFound+ is already included with your admin account.';
      case 'CREATOR_INCLUDED': return 'ReFound+ is included with the Creator account.';
      default: return 'Your one-time 24-hour trial is ready to start.';
    }
  };

  return <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
    <section className="relative overflow-hidden rounded-[2rem] border border-signal/20 bg-ink px-6 py-10 text-white shadow-card-hover sm:px-12 sm:py-14">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-beacon/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-signal/30 blur-3xl" />
      <div className="relative max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-beacon"><span aria-hidden="true">✦</span> Meet ReFound+</span>
        <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">Help good things find their way back.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-white/75 sm:text-lg">ReFound+ supports the campus recovery network and adds a little more room for personalization and saved alerts.</p>
        {!creatorLoading && isCreator && <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-violet-950/70 px-3 py-1.5 text-sm font-bold text-white"><GodModeBadge style={profile?.supporter_badge_style} className="h-7 w-7" /> Included for the Creator</span>}
        {!creatorLoading && isAdmin && !isCreator && <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-sm font-bold text-white"><ReFoundAdminBadge style={profile?.supporter_badge_style} /> ReFound Admin</span>}
        {!adminLoading && !isAdmin && plusActive && <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-beacon px-3 py-1.5 text-sm font-bold text-ink"><ReFoundPlusBadge style={profile?.supporter_badge_style} level={badgeLevel.label} className="h-8 w-8" /> ReFound+ · {badgeLevel.label}</span>}
        <div className="mt-7 rounded-2xl border border-beacon/30 bg-white/10 p-4 text-sm leading-6 text-white/85" role="status"><strong className="text-white">{isCreator ? 'Creator access is included.' : plusActive ? 'Your ReFound+ access is active.' : settings.enabled ? 'UPI support is open.' : 'Support options are not open yet.'}</strong> {isCreator ? 'The Creator receives ReFound+ perks at no charge.' : plusActive ? 'Thanks for helping keep ReFound running.' : settings.enabled ? 'Payments are checked by the Creator before access is activated.' : 'The Creator has not enabled public payments yet.'}</div>
      </div>
    </section>

    <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{SUPPORTER_EXTRAS.map(([icon,title,body], index) => {
      const roleEquivalent = isAdmin && !isCreator && [1, 4, 5].includes(index);
      const state = index === 1 && isCreator ? 'The Creator' : roleEquivalent ? 'Admin equivalent' : isCreator ? 'Included' : plusActive ? 'Included' : 'ReFound+';
      return <article key={title} className="rounded-card border border-border bg-white p-6 shadow-card"><div className="flex items-center justify-between gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-beacon/15 text-xl text-beacon-dark" aria-hidden="true">{icon}</span>{state === 'The Creator' ? <GodModeBadge style={profile?.supporter_badge_style} className="h-7 w-7" /> : roleEquivalent ? <ReFoundAdminBadge style={profile?.supporter_badge_style} /> : index === 1 && plusActive && !isAdmin ? <ReFoundPlusBadge style={profile?.supporter_badge_style} level={badgeLevel.label} className="h-7 w-7" /> : <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate">{state}</span>}</div><h2 className="mt-4 font-display text-lg font-bold text-ink">{title}</h2><p className="mt-2 text-sm leading-6 text-slate">{body}</p></article>;
    })}</section>

    {perksIncluded && <div className="mt-8"><PlusImpactRecap /></div>}

    {!creatorLoading && !isCreator && <section className="mt-8 rounded-2xl border border-beacon/30 bg-white p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <span className="inline-flex rounded-full bg-beacon/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-beacon-dark">One-time offer</span>
          <h2 className="mt-3 font-display text-xl font-bold text-ink">Try ReFound+ free for 24 hours</h2>
          <p className="mt-2 text-sm leading-6 text-slate">Explore the supporter features for one full day. No payment details are needed; the trial starts only when you press the button and ends automatically after 24 hours. Each account and email can claim it once.</p>
        </div>
        {user ? (
          <Button onClick={() => void startTrial()} loading={working} disabled={!trialStatus?.eligible || loading}>
            Start my free trial
          </Button>
        ) : (
          <Link to="/login" className="inline-flex items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">Log in to check eligibility</Link>
        )}
      </div>
      {user && <p className={`mt-4 text-sm ${trialStatus?.eligible ? 'font-medium text-beacon-dark' : 'text-slate'}`} role="status">{loading ? 'Checking trial eligibility…' : trialMessage()}</p>}
    </section>}

    <section className="mt-8 rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8" aria-label="ReFound+ thank-you wall">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-ink">The ReFound+ thank-you wall</h2><p className="mt-1 text-sm text-slate">A thank-you to ReFound+ members and Admins who chose to be recognized. Names appear only with permission.</p></div><span className="rounded-full border border-border px-3 py-1 text-xs text-slate">Opt-in only</span></div>
      {wallLoading ? <p className="mt-5 text-sm text-slate">Loading the thank-you wall…</p> : wallError ? <p role="alert" className="mt-5 text-sm text-coral-dark">Could not load the thank-you wall: {wallError}</p> : supporters.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{supporters.map((supporter, index) => <article key={`${supporter.display_name}-${index}`} className="flex items-center gap-3 rounded-xl border border-border bg-paper/60 p-3">{supporter.badge_level === 'ReFound Admin' ? <ReFoundAdminBadge style={supporter.badge_style} className="h-12 w-12 shrink-0" /> : <ReFoundPlusBadge style={supporter.badge_style} level={supporter.badge_level} className="h-12 w-12 shrink-0" />}<div className="min-w-0"><p className="truncate font-semibold text-ink">{supporter.display_name}</p><p className="text-xs text-slate">{supporter.badge_level}</p></div></article>)}</div> : <p className="mt-5 rounded-xl bg-paper p-4 text-sm text-slate">No one has opted in yet. You can choose whether to be recognized from Profile → Profile rewards.</p>}
    </section>

    {!creatorLoading && !isCreator && !plusActive && (settings.enabled || currentRequest) && user && <section className="mt-8 rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-ink">Support with UPI</h2><p className="mt-1 text-sm text-slate">{settings.plan === 'ONE_TIME' ? 'One-time support payment' : `Renew manually every ${settings.period_days} days`} · ₹{settings.price_inr}</p></div><Button variant="ghost" size="sm" onClick={() => void refresh()} loading={loading}>Refresh status</Button></div>
      {!currentRequest ? <div className="mt-5">{settings.enabled ? <Button onClick={() => void createRequest()} loading={working}>Continue to UPI payment</Button> : <p className="text-sm text-slate">Public support is currently paused by the Creator.</p>}</div> : <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
        <div><p className="text-sm leading-6 text-slate">Pay <strong className="text-ink">₹{currentRequest.amount_inr}</strong> to <strong className="text-ink">{currentRequest.payee_name}</strong>{currentRequest.upi_vpa ? <> ({currentRequest.upi_vpa})</> : null}. Use the QR or open your UPI app from this device.</p>
          {!qrBroken ? <img src={currentRequest.qr_url || '/refound-plus-upi-qr.png'} alt="ReFound+ UPI payment QR code" onError={() => setQrBroken(true)} className="mt-4 h-48 w-48 rounded-xl border border-border bg-white object-contain p-2" /> : <div className="mt-4 flex h-48 w-48 items-center justify-center rounded-xl border-2 border-dashed border-border bg-paper p-4 text-center text-xs text-slate">UPI QR image will appear here when configured by the Creator.</div>}
          {currentRequest.upi_vpa && <a className="mt-4 inline-flex rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white" href={paymentUri(currentRequest)}>Open UPI app</a>}
          {currentRequest.status === 'AWAITING_PAYMENT' ? <><form onSubmit={(e) => void submitUtr(e)} className="mt-6 max-w-xl"><label htmlFor="plus-utr" className="block text-sm font-semibold text-ink">After paying, enter the UPI transaction reference / UTR</label><input id="plus-utr" value={utr} onChange={(e) => setUtr(e.target.value)} required minLength={8} maxLength={40} className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-ink" placeholder="Shown in your UPI app"/><p className="mt-1 text-xs text-slate">Submitting a reference does not activate access. The Creator checks the payment first.</p><Button type="submit" loading={working} className="mt-3">Send for review</Button></form><button type="button" onClick={() => void cancelRequest()} disabled={working} className="mt-3 text-sm font-medium text-slate underline">Cancel this unpaid request</button></> : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Payment reference received. ReFound+ activates after Creator review. You can close this page and check back later.</p>}
        </div><aside className="rounded-xl bg-paper p-4 text-sm leading-6 text-slate"><h3 className="font-semibold text-ink">Payment status</h3><p className="mt-2">{currentRequest.status.replaceAll('_',' ')}</p><p className="mt-2 text-xs">Request: {currentRequest.id.slice(0,8)}</p><p className="mt-4 text-xs">For your safety, verify the payee name in your UPI app before approving the transfer.</p></aside>
      </div>}
    </section>}

    {user && requests.some((r) => !['AWAITING_PAYMENT','PENDING_REVIEW'].includes(r.status)) && <section className="mt-8 rounded-2xl border border-border bg-white p-6"><h2 className="font-display text-lg font-bold text-ink">Previous payment requests</h2><ul className="mt-3 space-y-2">{requests.filter((r) => !['AWAITING_PAYMENT','PENDING_REVIEW'].includes(r.status)).map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-paper p-3 text-sm"><span>₹{r.amount_inr} · {r.plan === 'ONE_TIME' ? 'One-time' : 'Subscription'}</span><strong>{r.status}{r.admin_note ? ` · ${r.admin_note}` : ''}</strong></li>)}</ul></section>}
    {!user && <section className="mt-8 rounded-2xl border border-border bg-white p-6"><p className="text-sm text-slate">Sign in to support ReFound and manage your membership.</p><Link to="/login" className="mt-3 inline-flex rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">Log in</Link></section>}
    {loading && user && <p className="mt-4 text-sm text-slate">Checking membership and payment status…</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    <section className="mt-8 rounded-card border border-border bg-white p-6 shadow-card sm:p-8"><h2 className="font-display text-xl font-bold text-ink">The same fair recovery for everyone.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate">Reporting, matching, ownership verification, and coordinating a return stay free for every student. ReFound+ never sells faster recovery or access to private item details.</p><Link to="/" className="mt-5 inline-flex rounded-xl border border-border px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-paper">Back to ReFound</Link></section>
  </main>;
}
