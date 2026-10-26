import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { fetchMyCampusVerificationStatus } from '../lib/adminService';
import { supabase } from '../lib/supabase';

function allowedEmail(email: string, domains: string[]) {
  const domain = email.trim().toLowerCase().split('@').pop() ?? '';
  return domains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

export function CampusVerificationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(user?.email ?? '');
  const [domains, setDomains] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    fetchMyCampusVerificationStatus().then(({ status, error: statusError }) => {
      if (!active) return;
      if (statusError || !status) setError(statusError ?? 'Could not load verification status.');
      else {
        setDomains(status.domains);
        setEnabled(status.enabled);
        setVerified(status.verified);
        setEmail(status.email ?? user.email ?? '');
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id, user?.email]);

  const requestConfirmation = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!allowedEmail(email, domains)) {
      setError(`Use an email address ending in ${domains.join(' or ')}.`);
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${window.location.origin}/verify-campus` }
    );
    setSaving(false);
    if (updateError) setError(updateError.message);
    else setSent(true);
  };

  const checkVerification = async () => {
    setError(null);
    setSaving(true);
    const { status, error: statusError } = await fetchMyCampusVerificationStatus();
    setSaving(false);
    if (statusError || !status) setError(statusError ?? 'Could not check verification status.');
    else {
      setEnabled(status.enabled);
      setVerified(status.verified);
      setEmail(status.email ?? email);
      if (!status.verified && status.enabled) setError('The campus email is not confirmed yet. Open the link in your email, then check again.');
    }
  };

  if (!user) return <div className="mx-auto max-w-lg px-4 py-16 text-center">
    <h1 className="font-display text-2xl font-bold text-ink">Sign in to verify your campus account</h1>
    <Link to="/login" className="mt-5 inline-block font-semibold text-signal">Go to login</Link>
  </div>;
  if (loading) return <Spinner label="Checking campus verification…" />;
  if (error && domains.length === 0) return <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-coral-dark">{error}</div>;
  if (!enabled || verified) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">Campus access is ready</h1>
      <p className="mt-2 text-sm text-slate">{!enabled ? 'Campus verification is currently disabled.' : 'Your campus email is verified.'}</p>
      <Button className="mt-6" onClick={() => navigate('/dashboard', { replace: true })}>Continue to ReFound</Button>
    </div>;
  }

  return <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
    <h1 className="font-display text-2xl font-bold text-ink">Verify your campus email</h1>
    <p className="mt-2 text-sm text-slate">ReFound is currently limited to campus accounts. Use an address from {domains.join(', ')}.</p>
    {sent ? <div className="mt-6 rounded-xl border border-border bg-white p-5 text-sm text-slate" role="status">
      Confirmation requested for <strong className="text-ink">{email}</strong>. Check your email (and, if prompted by Supabase, your previous email) and complete the confirmation. Then check your access below.
      <div><Button className="mt-4" loading={saving} onClick={() => void checkVerification()}>I&rsquo;ve confirmed — check access</Button></div>
    </div> : <form onSubmit={requestConfirmation} className="mt-6">
      <Input label="Campus email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      {error && <p className="mt-3 text-sm text-coral-dark" role="alert">{error}</p>}
      <Button className="mt-5" type="submit" loading={saving}>Send confirmation email</Button>
    </form>}
    <p className="mt-5 text-xs text-slate">If the confirmation does not arrive, check spam or ask a ReFound admin to review the campus domain settings.</p>
  </div>;
}
