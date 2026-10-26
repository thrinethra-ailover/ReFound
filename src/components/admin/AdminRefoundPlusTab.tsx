import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import {
  DEFAULT_REFOUND_PLUS_SETTINGS,
  fetchAdminRefoundPlusRequests,
  fetchRefoundPlusSettings,
  reviewRefoundPlusRequest,
  updateRefoundPlusSettings,
  uploadRefoundPlusQr,
  type AdminRefoundPlusPaymentRequest,
  type RefoundPlusSettings,
} from '../../lib/refoundPlusService';

export function AdminRefoundPlusTab() {
  const [settings, setSettings] = useState<RefoundPlusSettings>(DEFAULT_REFOUND_PLUS_SETTINGS);
  const [requests, setRequests] = useState<AdminRefoundPlusPaymentRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [settingsResult, requestsResult] = await Promise.all([fetchRefoundPlusSettings(), fetchAdminRefoundPlusRequests()]);
    if (settingsResult.settings) setSettings(settingsResult.settings);
    const nextError = settingsResult.error ?? requestsResult.error;
    setError(nextError);
    setRequests(requestsResult.requests);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true); setSaved(false); setError(null);
    const result = await updateRefoundPlusSettings(settings);
    setSaving(false);
    if (result.error) setError(result.error); else setSaved(true);
  };

  const uploadQr = async (file?: File) => {
    if (!file) return;
    setError(null);
    const result = await uploadRefoundPlusQr(file);
    if (result.error || !result.url) setError(result.error ?? 'QR upload failed.');
    else setSettings((value) => ({ ...value, qr_url: result.url }));
  };

  const review = async (request: AdminRefoundPlusPaymentRequest, approve: boolean) => {
    setWorking(request.id); setError(null);
    const result = await reviewRefoundPlusRequest(request.id, approve, notes[request.id] ?? '');
    setWorking(null);
    if (result.error) setError(result.error); else await load();
  };

  const field = 'mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-ink';
  return <div className="space-y-6">
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-bold text-ink">ReFound+ settings</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate">Configure a UPI ID or QR image, plus the payee name and membership terms. Payments are reviewed manually; approving a request is the only way a supporter receives paid access. Leave public support disabled while you test.</p>
      {loading ? <p className="mt-5 text-sm text-slate">Loading ReFound+ settings…</p> : <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink">UPI ID / VPA<input className={field} value={settings.vpa ?? ''} onChange={(e) => setSettings({ ...settings, vpa: e.target.value })} placeholder="name@bank" /></label>
        <label className="text-sm font-medium text-ink">Payee name<input className={field} value={settings.payee_name ?? ''} onChange={(e) => setSettings({ ...settings, payee_name: e.target.value })} placeholder="Name shown in UPI app" /></label>
        <label className="text-sm font-medium text-ink">Price (INR)<input className={field} type="number" min="1" step="1" value={settings.price_inr ?? ''} onChange={(e) => setSettings({ ...settings, price_inr: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 49" /></label>
        <label className="text-sm font-medium text-ink">Payment plan<select className={field} value={settings.plan} onChange={(e) => setSettings({ ...settings, plan: e.target.value as RefoundPlusSettings['plan'] })}><option value="ONE_TIME">One-time payment</option><option value="SUBSCRIPTION">Subscription (manual renewal)</option></select></label>
        {settings.plan === 'SUBSCRIPTION' && <label className="text-sm font-medium text-ink">Membership duration in days<input className={field} type="number" min="1" max="366" value={settings.period_days} onChange={(e) => setSettings({ ...settings, period_days: Number(e.target.value) })} /></label>}
        <label className="text-sm font-medium text-ink sm:col-span-2">UPI QR image<input className={`${field} file:mr-3 file:rounded-lg file:border-0 file:bg-paper file:px-3 file:py-1.5`} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadQr(e.target.files?.[0])} /><span className="mt-1 block text-xs text-slate">PNG, JPG, or WebP, up to 5 MB. Upload is public so students can scan the payment QR. {settings.qr_url ? 'QR uploaded.' : 'No QR uploaded yet.'}</span></label>
        {settings.qr_url && <img src={settings.qr_url} alt="UPI payment QR preview" className="h-40 w-40 rounded-xl border border-border bg-white object-contain p-2" />}
      </div>}
      {!loading && <>
        <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink"><input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className="h-4 w-4 accent-signal" /> Enable ReFound+ checkout for public users</label>
        <div className="mt-5 flex flex-wrap items-center gap-3"><Button onClick={() => void save()} loading={saving}>Save ReFound+ settings</Button>{saved && <span role="status" className="text-sm text-emerald-700">Settings saved.</span>}</div>
      </>}
      <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>UPI limitation:</strong> a QR/VPA payment cannot confirm itself inside ReFound. Verify the amount, payee, and UTR in your UPI/bank records before approving. “Subscription” means the member makes a fresh payment at each renewal; this does not create automatic UPI AutoPay.</div>
    </section>

    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-ink">Payment requests</h2><p className="mt-1 text-sm text-slate">Pending requests appear first. Approve only after you confirm the UPI transaction.</p></div><Button variant="ghost" size="sm" onClick={() => void load()} loading={loading}>Refresh</Button></div>
      {loading ? <p className="mt-5 text-sm text-slate">Loading requests…</p> : requests.length === 0 ? <p className="mt-5 rounded-xl bg-paper p-4 text-sm text-slate">No payment requests yet.</p> : <div className="mt-5 space-y-3">{requests.map((request) => <article key={request.id} className="rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-ink">{request.user_name || request.user_email}</h3><p className="text-xs text-slate">{request.user_email} · ₹{request.amount_inr} · {request.plan === 'ONE_TIME' ? 'One-time' : `${request.period_days}-day renewal`} · {new Date(request.created_at).toLocaleString()}</p></div><span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink">{request.status.replaceAll('_',' ')}</span></div>
        {request.utr && <p className="mt-3 break-all rounded-lg bg-paper p-3 text-sm text-ink"><strong>UPI reference:</strong> {request.utr}</p>}
        {request.admin_note && <p className="mt-2 text-sm text-slate">Previous note: {request.admin_note}</p>}
        {request.status === 'PENDING_REVIEW' && <><textarea value={notes[request.id] ?? ''} onChange={(e) => setNotes({ ...notes, [request.id]: e.target.value })} rows={2} placeholder="Optional note to the user" className={`${field} mt-3`} /><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void review(request, true)} loading={working === request.id}>Approve & activate</Button><Button size="sm" variant="danger" onClick={() => void review(request, false)} loading={working === request.id}>Reject</Button></div></>}
      </article>)}</div>}
    </section>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
  </div>;
}
