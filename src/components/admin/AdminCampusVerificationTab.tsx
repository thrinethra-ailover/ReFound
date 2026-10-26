import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { fetchCampusVerificationSettings, updateCampusVerificationSettings } from '../../lib/adminService';

export function AdminCampusVerificationTab() {
  const [enabled, setEnabled] = useState(false);
  const [domainsText, setDomainsText] = useState('student.nitw.ac.in');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { settings, error: loadError } = await fetchCampusVerificationSettings();
    if (loadError || !settings) setError(loadError ?? 'Could not load campus settings.');
    else {
      setEnabled(settings.enabled);
      setDomainsText(settings.domains.join('\n'));
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const domains = domainsText.split(/[\s,;]+/).map((domain) => domain.trim().toLowerCase()).filter(Boolean);
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: saveError } = await updateCampusVerificationSettings(enabled, domains);
    setSaving(false);
    if (saveError) setError(saveError);
    else setSaved(true);
  };

  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-bold text-ink">Campus account verification</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate">
        When enabled, people need a confirmed email from an approved campus domain before they can use ReFound.
        Admin accounts keep access so you can manage this setting.
      </p>
      {loading ? <p className="mt-6 text-sm text-slate">Loading settings…</p> : (
        <>
          <label className="mt-6 flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-signal" />
            Require campus email verification
          </label>
          <label className="mt-6 block text-sm font-medium text-ink" htmlFor="campus-domains">Allowed email domains</label>
          <textarea
            id="campus-domains"
            value={domainsText}
            onChange={(event) => setDomainsText(event.target.value)}
            rows={4}
            placeholder="student.nitw.ac.in"
            className="mt-2 w-full max-w-xl rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-signal"
          />
          <p className="mt-1 text-xs text-slate">Enter one domain per line, without @. Current default: student.nitw.ac.in. Subdomains are accepted.</p>
          <div className="mt-5 flex items-center gap-3">
            <Button onClick={() => void save()} loading={saving}>Save campus settings</Button>
            {saved && <span className="text-sm text-emerald-700" role="status">Settings saved.</span>}
          </div>
          {error && <p className="mt-4 text-sm text-coral-dark" role="alert">{error}</p>}
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Before enabling this, turn on <strong>Confirm email</strong> in Supabase Authentication settings. Users must click Supabase&rsquo;s confirmation link; ReFound does not send or store confirmation codes.
          </div>
        </>
      )}
    </section>
  );
}
