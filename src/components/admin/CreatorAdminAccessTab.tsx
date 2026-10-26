import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { fetchManagedAdmins, grantManagedAdmin, revokeManagedAdmin, type ManagedAdmin } from '../../lib/adminService';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function CreatorAdminAccessTab() {
  const [admins, setAdmins] = useState<ManagedAdmin[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminToRemove, setAdminToRemove] = useState<ManagedAdmin | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchManagedAdmins();
    setAdmins(result.admins);
    setError(result.error);
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const add = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(null);
    const result = await grantManagedAdmin(email.trim());
    setBusy(false);
    if (result.error) setError(result.error);
    else { setEmail(''); await refresh(); }
  };
  const remove = async () => {
    if (!adminToRemove) return;
    setBusy(true); setError(null);
    const result = await revokeManagedAdmin(adminToRemove.user_id);
    setBusy(false);
    setAdminToRemove(null);
    if (result.error) setError(result.error); else await refresh();
  };
  return <section className="space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm">
    <div><h2 className="font-display text-lg font-bold text-ink">Admin access</h2><p className="mt-1 text-sm text-slate">Grant or remove the reduced ReFound Admin role. Admins can moderate reports and handle support, but cannot open this Creator console.</p></div>
    <form onSubmit={(event) => void add(event)} className="flex flex-wrap gap-2">
      <label className="sr-only" htmlFor="creator-admin-email">Account email</label>
      <input id="creator-admin-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Registered account email" className="min-w-64 flex-1 rounded-xl border border-border px-3 py-2 text-sm" />
      <Button type="submit" loading={busy}>Grant admin access</Button>
    </form>
    {loading ? <p className="text-sm text-slate">Loading admins…</p> : admins.length === 0 ? <p className="rounded-xl bg-paper p-4 text-sm text-slate">No separate Admin accounts have been added.</p> : <ul className="divide-y divide-border rounded-xl border border-border">{admins.map((admin) => <li key={admin.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold text-ink">{admin.full_name || admin.email}</p><p className="text-sm text-slate">{admin.email}</p></div><Button variant="danger" size="sm" disabled={busy} onClick={() => setAdminToRemove(admin)}>Remove</Button></li>)}</ul>}
    {error && <p role="alert" className="text-sm text-coral-dark">{error}</p>}
    <Modal
      open={Boolean(adminToRemove)}
      onClose={() => { if (!busy) setAdminToRemove(null); }}
      title="Remove Admin access?"
      footer={<>
        <Button variant="ghost" disabled={busy} onClick={() => setAdminToRemove(null)}>Keep Admin</Button>
        <Button variant="danger" loading={busy} onClick={() => void remove()}>Remove access</Button>
      </>}
    >
      <p>This will remove ReFound Admin access for <strong className="text-ink">{adminToRemove?.email}</strong>. They’ll keep their account and can still use ReFound as a regular user.</p>
    </Modal>
  </section>;
}
