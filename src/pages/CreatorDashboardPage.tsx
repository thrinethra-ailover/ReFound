import { useState } from 'react';
import { AdminOverviewTab } from '../components/admin/AdminOverviewTab';
import { AdminAnalyticsTab } from '../components/admin/AdminAnalyticsTab';
import { AdminSuspiciousActivityTab } from '../components/admin/AdminSuspiciousActivityTab';
import { AdminReportsTab } from '../components/admin/AdminReportsTab';
import { AdminAuditLogTab } from '../components/admin/AdminAuditLogTab';
import { AdminCampusVerificationTab } from '../components/admin/AdminCampusVerificationTab';
import { AdminReportFlagsTab } from '../components/admin/AdminReportFlagsTab';
import { AdminSupportChatTab } from '../components/admin/AdminSupportChatTab';
import { AdminRefoundPlusTab } from '../components/admin/AdminRefoundPlusTab';
import { CreatorAdminAccessTab } from '../components/admin/CreatorAdminAccessTab';

const tabs = [
  ['OVERVIEW', 'Overview'], ['ANALYTICS', 'Analytics'], ['SUSPICIOUS', 'Suspicious activity'],
  ['REPORTS', 'Reports'], ['USER_FLAGS', 'User flags'], ['AUDIT', 'Audit log'],
  ['CAMPUS', 'Campus access'], ['SUPPORT', 'Support chat'], ['REFOUND_PLUS', 'ReFound+'], ['ADMINS', 'Admin access'],
] as const;
type Tab = typeof tabs[number][0];

export function CreatorDashboardPage() {
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <header><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Creator console</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">Zephyrath’s Playground</h1><p className="mt-1 text-sm text-slate">Your private control room for ReFound, its administrators, and creator-only features.</p></header>
    <div className="mt-6 flex gap-2 overflow-x-auto pb-1">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === key ? 'bg-ink text-white' : 'border border-border bg-white text-ink hover:bg-black/[0.02]'}`}>{label}</button>)}</div>
    <div className="mt-6">
      {tab === 'OVERVIEW' && <AdminOverviewTab />}{tab === 'ANALYTICS' && <AdminAnalyticsTab />}
      {tab === 'SUSPICIOUS' && <AdminSuspiciousActivityTab />}{tab === 'REPORTS' && <AdminReportsTab />}
      {tab === 'USER_FLAGS' && <AdminReportFlagsTab />}{tab === 'AUDIT' && <AdminAuditLogTab />}
      {tab === 'CAMPUS' && <AdminCampusVerificationTab />}{tab === 'SUPPORT' && <AdminSupportChatTab />}
      {tab === 'REFOUND_PLUS' && <AdminRefoundPlusTab />}{tab === 'ADMINS' && <CreatorAdminAccessTab />}
    </div>
  </div>;
}
