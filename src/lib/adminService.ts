import { supabase } from './supabase';
import type {
  AdminDashboardStats,
  AdminReportDetails,
  AdminMatchAnalytics,
  AuditLogEntry,
  CategoryFrequencyRow,
  FlagStatus,
  ItemWithImages,
  LocationHeatmapRow,
  RecoveryHotspotRow,
  SuspiciousActivityFlag,
  TimeDistributionRow,
} from '../types/database';

export interface CampusVerificationSettings {
  enabled: boolean;
  domains: string[];
}

export async function fetchCampusVerificationSettings(): Promise<{
  settings: CampusVerificationSettings | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('get_campus_verification_settings');
  if (error) return { settings: null, error: error.message };
  return { settings: data as CampusVerificationSettings | null, error: null };
}

export async function updateCampusVerificationSettings(
  enabled: boolean,
  domains: string[]
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_update_campus_verification', {
    p_enabled: enabled,
    p_domains: domains,
  });
  return { error: error?.message ?? null };
}

export interface CampusVerificationStatus extends CampusVerificationSettings {
  verified: boolean;
  email: string | null;
}

export async function fetchMyCampusVerificationStatus(): Promise<{
  status: CampusVerificationStatus | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('my_campus_verification_status');
  if (error) return { status: null, error: error.message };
  return { status: data as CampusVerificationStatus | null, error: null };
}

/** Checks admin status server-side — never trust a client-only flag. */
export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return Boolean(data);
}

/** Creator identity is maintained only in Supabase, never in the public client bundle. */
export async function checkIsCreator(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_creator');
  return !error && Boolean(data);
}

export interface ManagedAdmin { user_id: string; email: string; full_name: string | null; granted_at: string; }
export async function fetchManagedAdmins(): Promise<{ admins: ManagedAdmin[]; error: string | null }> {
  const { data, error } = await supabase.rpc('creator_list_admins');
  return { admins: (data ?? []) as ManagedAdmin[], error: error?.message ?? null };
}
export async function grantManagedAdmin(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('creator_grant_admin', { p_email: email });
  return { error: error?.message ?? null };
}
export async function revokeManagedAdmin(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('creator_revoke_admin', { p_user_id: userId });
  return { error: error?.message ?? null };
}

export async function fetchDashboardStats(): Promise<{ stats: AdminDashboardStats | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats');
  if (error) return { stats: null, error: error.message };
  const row = (data ?? [])[0] ?? null;
  return { stats: row, error: null };
}

export async function fetchMatchAnalytics(): Promise<{ analytics: AdminMatchAnalytics | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_match_analytics');
  if (error) return { analytics: null, error: error.message };
  const row = (data ?? [])[0] ?? null;
  return { analytics: row, error: null };
}

export async function fetchLocationHeatmap(): Promise<{ rows: LocationHeatmapRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_location_heatmap');
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as LocationHeatmapRow[], error: null };
}

export async function fetchRecoveryHotspots(): Promise<{ rows: RecoveryHotspotRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_recovery_hotspots');
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as RecoveryHotspotRow[], error: null };
}

export async function fetchCategoryFrequency(): Promise<{ rows: CategoryFrequencyRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_category_frequency');
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as CategoryFrequencyRow[], error: null };
}

export async function fetchTimeDistribution(): Promise<{ rows: TimeDistributionRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_time_distribution');
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as TimeDistributionRow[], error: null };
}

export async function fetchSuspiciousActivityFlags(): Promise<{
  flags: SuspiciousActivityFlag[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('suspicious_activity_flags')
    .select('*')
    .order('risk_score', { ascending: false });
  if (error) return { flags: [], error: error.message };
  return { flags: (data ?? []) as SuspiciousActivityFlag[], error: null };
}

export async function refreshSuspiciousActivity(): Promise<{ flaggedCount: number; error: string | null }> {
  const { data, error } = await supabase.rpc('refresh_suspicious_activity');
  if (error) return { flaggedCount: 0, error: error.message };
  return { flaggedCount: Number(data ?? 0), error: null };
}

export async function reviewFlag(
  flagId: string,
  status: FlagStatus,
  notes?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_review_flag', {
    p_flag_id: flagId,
    p_status: status,
    p_notes: notes ?? null,
  });
  return { error: error?.message ?? null };
}

export async function fetchAuditLog(limit = 100): Promise<{ entries: AuditLogEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { entries: [], error: error.message };
  return { entries: (data ?? []) as AuditLogEntry[], error: null };
}

export async function fetchAllItems(): Promise<{ items: ItemWithImages[]; error: string | null }> {
  const pageSize = 500;
  const items: ItemWithImages[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('items')
      .select('*, item_images(*)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return { items: [], error: error.message };
    items.push(...((data ?? []) as ItemWithImages[]));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return { items, error: null };
}

export async function fetchActiveReportDetails(
  itemId: string
): Promise<{ details: AdminReportDetails | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_get_active_report_details', { p_item_id: itemId });
  if (error) return { details: null, error: error.message };
  return { details: (data ?? null) as AdminReportDetails | null, error: null };
}

export async function deactivateItem(itemId: string, reason: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_deactivate_item', { p_item_id: itemId, p_reason: reason });
  return { error: error?.message ?? null };
}

export async function resolveItemAsAdmin(itemId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_resolve_item', { p_item_id: itemId });
  return { error: error?.message ?? null };
}
