import { useState } from 'react';
import { AdminOverviewTab } from '../components/admin/AdminOverviewTab';
import { AdminAnalyticsTab } from '../components/admin/AdminAnalyticsTab';
import { AdminSuspiciousActivityTab } from '../components/admin/AdminSuspiciousActivityTab';
import { AdminReportsTab } from '../components/admin/AdminReportsTab';
import { AdminAuditLogTab } from '../components/admin/AdminAuditLogTab';
import { AdminCampusVerificationTab } from '../components/admin/AdminCampusVerificationTab';
import { AdminReportFlagsTab } from '../components/admin/AdminReportFlagsTab';
import { AdminSupportChatTab } from '../components/admin/AdminSupportChatTab';

type AdminTab = 'OVERVIEW' | 'ANALYTICS' | 'SUSPICIOUS' | 'REPORTS' | 'USER_FLAGS' | 'AUDIT' | 'CAMPUS' | 'SUPPORT';

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'OVERVIEW', label: 'Overview' },
  { key: 'ANALYTICS', label: 'Analytics' },
  { key: 'SUSPICIOUS', label: 'Suspicious activity' },
  { key: 'REPORTS', label: 'Reports' },
  { key: 'USER_FLAGS', label: 'User flags' },
  { key: 'AUDIT', label: 'Audit log' },
  { key: 'CAMPUS', label: 'Campus access' },
  { key: 'SUPPORT', label: 'Support chat' },
];

export function AdminDashboardPage() {
  const [tab, setTab] = useState<AdminTab>('OVERVIEW');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">ReFound Admin</h1>
            <p className="mt-1 text-sm text-slate">Manage reports, moderation, campus access, and aggregate activity.</p>
          </div>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-ink text-white' : 'bg-white text-ink border border-border hover:bg-black/[0.02]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'OVERVIEW' && <AdminOverviewTab />}
          {tab === 'ANALYTICS' && <AdminAnalyticsTab />}
          {tab === 'SUSPICIOUS' && <AdminSuspiciousActivityTab />}
          {tab === 'REPORTS' && <AdminReportsTab canViewPrivateDetails={false} />}
          {tab === 'USER_FLAGS' && <AdminReportFlagsTab />}
          {tab === 'AUDIT' && <AdminAuditLogTab />}
          {tab === 'CAMPUS' && <AdminCampusVerificationTab />}
          {tab === 'SUPPORT' && <AdminSupportChatTab />}
        </div>
    </div>
  );
}
