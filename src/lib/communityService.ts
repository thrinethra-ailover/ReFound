import { supabase } from './supabase';
import type { ReportType } from '../types/database';

export interface SavedSearch {
  id: string;
  label: string;
  keyword: string | null;
  report_type: 'ALL' | ReportType;
  category: string | null;
  location: string | null;
  enabled: boolean;
  created_at: string;
}

export async function fetchSavedSearches(): Promise<{ searches: SavedSearch[]; error: string | null }> {
  const { data, error } = await supabase.from('saved_searches').select('*').order('created_at', { ascending: false });
  return { searches: (data ?? []) as SavedSearch[], error: error?.message ?? null };
}

export async function createSavedSearch(input: Omit<SavedSearch, 'id' | 'created_at' | 'enabled'> & { user_id: string }): Promise<{ error: string | null }> {
  const { error } = await supabase.from('saved_searches').insert(input);
  return { error: error?.message ?? null };
}

export async function deleteSavedSearch(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('saved_searches').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function flagReport(input: {
  itemId: string;
  reporterId: string;
  reason: string;
  details: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('report_abuse_flags').insert({
    item_id: input.itemId,
    reporter_id: input.reporterId,
    reason: input.reason,
    details: input.details.trim() || null,
  });
  return { error: error?.message ?? null };
}

export interface ReportAbuseFlag {
  id: string;
  item_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  item?: { title: string; report_type: ReportType; status: string } | null;
}

export async function fetchReportAbuseFlags(): Promise<{ flags: ReportAbuseFlag[]; error: string | null }> {
  const { data, error } = await supabase.from('report_abuse_flags')
    .select('*, item:items(title, report_type, status)').order('created_at', { ascending: false });
  return { flags: (data ?? []) as ReportAbuseFlag[], error: error?.message ?? null };
}

export async function reviewReportAbuseFlag(id: string, status: 'REVIEWED' | 'DISMISSED'): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_review_report_flag', { p_flag_id: id, p_status: status });
  return { error: error?.message ?? null };
}

export async function actOnFlaggedReport(id: string, action: 'RESOLVE' | 'DEACTIVATE'): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_act_on_report_flag', { p_flag_id: id, p_action: action });
  return { error: error?.message ?? null };
}
