import type { RefoundPlusEntitlement } from '../types/database';
import type { ReFoundPlusBadgeStyle } from '../types/database';
import { supabase } from './supabase';

export interface ReFoundPlusImpact {
  reports_shared: number;
  lost_reports: number;
  found_reports: number;
  recoveries_confirmed: number;
}

export interface PublicSupporter {
  display_name: string;
  badge_level: string;
  badge_style: ReFoundPlusBadgeStyle;
}

export interface RefoundPlusSettings {
  enabled: boolean;
  vpa: string | null;
  payee_name: string | null;
  price_inr: number | null;
  plan: 'ONE_TIME' | 'SUBSCRIPTION';
  period_days: number;
  qr_url: string | null;
}

export interface RefoundPlusTrialStatus {
  eligible: boolean;
  claimed_at: string | null;
  ends_at: string | null;
  reason: 'AVAILABLE' | 'ALREADY_USED' | 'ACTIVE_MEMBERSHIP' | 'PENDING_PAYMENT' | 'CAMPUS_VERIFICATION_REQUIRED' | 'ADMIN_INCLUDED' | 'CREATOR_INCLUDED';
}

export interface RefoundPlusPaymentRequest {
  id: string;
  user_id: string;
  amount_inr: number;
  plan: 'ONE_TIME' | 'SUBSCRIPTION';
  period_days: number;
  upi_vpa: string | null;
  payee_name: string;
  qr_url: string | null;
  status: 'AWAITING_PAYMENT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  utr: string | null;
  admin_note: string | null;
  created_at: string;
}

export interface AdminRefoundPlusPaymentRequest extends Omit<RefoundPlusPaymentRequest, 'upi_vpa' | 'payee_name' | 'qr_url'> {
  user_name: string | null;
  user_email: string;
}

export const DEFAULT_REFOUND_PLUS_SETTINGS: RefoundPlusSettings = {
  enabled: false, vpa: null, payee_name: null, price_inr: null,
  plan: 'ONE_TIME', period_days: 30, qr_url: null,
};

export async function fetchRefoundPlusSettings() {
  const { data, error } = await supabase.rpc('get_refound_plus_settings');
  return { settings: (data as RefoundPlusSettings | null) ?? null, error: error?.message ?? null };
}

export async function updateRefoundPlusSettings(settings: RefoundPlusSettings) {
  const { error } = await supabase.rpc('admin_update_refound_plus_settings', {
    p_enabled: settings.enabled, p_vpa: settings.vpa, p_payee_name: settings.payee_name,
    p_price_inr: settings.price_inr, p_plan: settings.plan, p_period_days: settings.period_days,
    p_qr_url: settings.qr_url,
  });
  return { error: error?.message ?? null };
}

export async function uploadRefoundPlusQr(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return { url: null, error: 'Use a PNG, JPG, or WebP image.' };
  if (file.size > 5 * 1024 * 1024) return { url: null, error: 'The QR image must be 5 MB or smaller.' };
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png';
  const objectPath = `upi-qr-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from('refound-plus-assets').upload(objectPath, file, { upsert: false, contentType: file.type, cacheControl: '3600' });
  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from('refound-plus-assets').getPublicUrl(objectPath);
  return { url: data.publicUrl, error: null };
}

export async function createRefoundPlusPaymentRequest() {
  const { data, error } = await supabase.rpc('create_refound_plus_payment_request');
  return { id: (data as string | null) ?? null, error: error?.message ?? null };
}

export async function submitRefoundPlusUtr(requestId: string, utr: string) {
  const { error } = await supabase.rpc('submit_refound_plus_utr', { p_request_id: requestId, p_utr: utr });
  return { error: error?.message ?? null };
}

export async function cancelRefoundPlusPaymentRequest(requestId: string) {
  const { error } = await supabase.rpc('cancel_refound_plus_payment_request', { p_request_id: requestId });
  return { error: error?.message ?? null };
}

export async function fetchMyRefoundPlusRequests() {
  const { data, error } = await supabase.rpc('get_my_refound_plus_payment_requests');
  return { requests: (data ?? []) as RefoundPlusPaymentRequest[], error: error?.message ?? null };
}

export async function fetchAdminRefoundPlusRequests() {
  const { data, error } = await supabase.rpc('admin_list_refound_plus_payment_requests');
  return { requests: (data ?? []) as AdminRefoundPlusPaymentRequest[], error: error?.message ?? null };
}

export async function reviewRefoundPlusRequest(id: string, approve: boolean, note: string) {
  const { error } = await supabase.rpc('admin_review_refound_plus_payment', { p_request_id: id, p_approve: approve, p_note: note || null });
  return { error: error?.message ?? null };
}

export async function fetchMyRefoundPlusImpact() {
  const { data, error } = await supabase.rpc('get_my_refound_plus_impact');
  const first = Array.isArray(data) ? data[0] : null;
  return { impact: (first as ReFoundPlusImpact | undefined) ?? null, error: error?.message ?? null };
}

export async function fetchRefoundPlusSupporters() {
  const { data, error } = await supabase.rpc('get_refound_plus_supporter_wall');
  return { supporters: (data ?? []) as PublicSupporter[], error: error?.message ?? null };
}

export function getRefoundPlusBadgeLevel(entitlement: RefoundPlusEntitlement | null, now = Date.now()) {
  if (!entitlement) return { label: 'New supporter', days: 0, nextLabel: 'Beacon', daysToNext: 30 };
  const startedAt = entitlement.first_started_at ?? entitlement.starts_at ?? entitlement.created_at;
  const days = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 86_400_000));
  if (days >= 365) return { label: 'Legacy', days, nextLabel: null, daysToNext: 0 };
  if (days >= 90) return { label: 'Guardian', days, nextLabel: 'Legacy', daysToNext: 365 - days };
  if (days >= 30) return { label: 'Beacon', days, nextLabel: 'Guardian', daysToNext: 90 - days };
  return { label: 'New supporter', days, nextLabel: 'Beacon', daysToNext: 30 - days };
}

export async function fetchMyRefoundPlusEntitlement(userId: string): Promise<{
  entitlement: RefoundPlusEntitlement | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('refound_plus_entitlements')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    entitlement: (data as RefoundPlusEntitlement | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function fetchMyRefoundPlusTrialStatus() {
  const { data, error } = await supabase.rpc('get_my_refound_plus_trial_status');
  const first = Array.isArray(data) ? data[0] : null;
  return { status: (first as RefoundPlusTrialStatus | null) ?? null, error: error?.message ?? null };
}

export async function claimRefoundPlusFreeTrial() {
  const { data, error } = await supabase.rpc('claim_refound_plus_free_trial');
  return { endsAt: (data as string | null) ?? null, error: error?.message ?? null };
}

export function isRefoundPlusActive(entitlement: RefoundPlusEntitlement | null, now = Date.now()) {
  if (!entitlement || entitlement.status !== 'ACTIVE') return false;
  if (entitlement.starts_at && new Date(entitlement.starts_at).getTime() > now) return false;
  if (entitlement.ends_at && new Date(entitlement.ends_at).getTime() <= now) return false;
  return true;
}
