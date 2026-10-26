import { supabase } from './supabase';
import { ITEM_IMAGES_BUCKET } from '../utils/constants';
import { runMatchingForItem } from './matchService';
import type { Item, ItemVerificationAttribute, ReportType } from '../types/database';

export interface CreateItemInput {
  reporterId: string;
  reportType: ReportType;
  title: string;
  description: string;
  category: string;
  color: string;
  itemDatetime: string; // ISO string
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  image: File | null;
  distinctiveAttributes: { key: string; value: string }[];
}

export interface CreateItemResult {
  itemId: string | null;
  error: string | null;
  matchesFound?: number;
}

export interface SimilarReport {
  id: string;
  title: string;
  description: string | null;
  category: string;
  report_type: ReportType;
  location_name: string | null;
  item_datetime: string;
}

function searchableWords(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2));
}

/** Public-only, best-effort duplicate hints. Private verification attributes are never queried. */
export async function findSimilarReports(input: {
  title: string;
  description: string;
  category: string;
  reportType: ReportType;
  reporterId: string;
}): Promise<SimilarReport[]> {
  const { data, error } = await supabase.from('items')
    .select('id,title,description,category,report_type,location_name,item_datetime')
    .eq('status', 'ACTIVE').eq('report_type', input.reportType).eq('category', input.category)
    .neq('reporter_id', input.reporterId).order('created_at', { ascending: false }).limit(40);
  if (error || !data) return [];
  const query = searchableWords(`${input.title} ${input.description}`);
  if (query.size === 0) return [];
  return (data as SimilarReport[]).map((candidate) => {
    const words = searchableWords(`${candidate.title} ${candidate.description ?? ''}`);
    const overlap = [...query].filter((word) => words.has(word)).length;
    const score = overlap / Math.max(1, Math.min(query.size, words.size));
    return { candidate, score, overlap };
  }).filter(({ score, overlap }) => (query.size >= 2 && overlap >= 2) || (query.size >= 3 && score >= 0.7))
    .sort((a, b) => b.score - a.score).slice(0, 3).map(({ candidate }) => candidate);
}

export async function refreshMyStaleReports(): Promise<{ count: number; error: string | null }> {
  const { data, error } = await supabase.rpc('refresh_my_stale_reports');
  return { count: Number(data ?? 0), error: error?.message ?? null };
}

export async function confirmOwnItemActive(itemId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('confirm_own_item_active', { p_item_id: itemId });
  return { error: error?.message ?? null };
}

/**
 * Creates an item report, then attaches an optional image and any private
 * private attributes used later for blind ownership verification. Attributes
 * on FOUND reports are the hidden answers claimants must identify.
 * Distinctive attributes are written to a separate, report-owner-only table and are
 * never joined into public item queries. Finally, runs the deterministic
 * matching engine against existing opposite-type reports so matches appear
 * immediately without waiting on a background job.
 */
export async function createItemReport(input: CreateItemInput): Promise<CreateItemResult> {
  const { data: item, error: insertError } = await supabase
    .from('items')
    .insert({
      reporter_id: input.reporterId,
      report_type: input.reportType,
      title: input.title.trim(),
      description: input.description.trim() || null,
      category: input.category,
      color: input.color || null,
      item_datetime: input.itemDatetime,
      latitude: input.latitude,
      longitude: input.longitude,
      location_name: input.locationName.trim(),
    })
    .select('*')
    .single();

  if (insertError || !item) {
    return { itemId: null, error: insertError?.message ?? 'Could not create the report.' };
  }

  const itemId = item.id as string;

  if (input.image) {
    const uploadResult = await uploadItemImage(itemId, input.reporterId, input.image);
    if (uploadResult.error) {
      // Report itself was created successfully; surface the image error separately.
      return { itemId, error: `Report saved, but the image failed to upload: ${uploadResult.error}` };
    }
  }

  const attributesToSave = input.distinctiveAttributes.filter(
    (attr) => attr.key.trim() && attr.value.trim()
  );
  if (attributesToSave.length > 0) {
    const { error: attrError } = await supabase.from('item_verification_attributes').insert(
      attributesToSave.map((attr) => ({
        item_id: itemId,
        attribute_key: attr.key.trim(),
        attribute_value: attr.value.trim(),
      }))
    );
    if (attrError) {
      return { itemId, error: `Report saved, but distinctive attributes failed to save: ${attrError.message}` };
    }
  }

  const { matchesFound, error: matchError } = await runMatchingForItem(item as Item);
  if (matchError) {
    // Matching is best-effort at creation time; the Matches page can also
    // trigger it, so we don't fail the whole report submission for this.
    return { itemId, error: null, matchesFound: 0 };
  }

  return { itemId, error: null, matchesFound };
}

export async function uploadItemImage(
  itemId: string,
  reporterId: string,
  file: File
): Promise<{ error: string | null }> {
  const extension = file.name.split('.').pop() ?? 'jpg';
  const path = `${reporterId}/${itemId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(ITEM_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: imageRowError } = await supabase.from('item_images').insert({
    item_id: itemId,
    storage_path: path,
    is_primary: true,
  });

  if (imageRowError) {
    return { error: imageRowError.message };
  }

  return { error: null };
}

export function getItemImageUrl(storagePath: string): string {
  const { data } = supabase.storage.from(ITEM_IMAGES_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function updateOwnItemReport(input: {
  itemId: string;
  reporterId: string;
  title: string;
  description: string;
  category: string;
  color: string;
  itemDatetime: string;
  locationName: string;
  clearCoordinates?: boolean;
}): Promise<{ error: string | null }> {
  const { data, error } = await supabase.from('items').update({
    title: input.title.trim(),
    description: input.description.trim() || null,
    category: input.category,
    color: input.color || null,
    item_datetime: input.itemDatetime,
    location_name: input.locationName.trim(),
    last_confirmed_active_at: new Date().toISOString(),
    stale_reminded_at: null,
    ...(input.clearCoordinates ? { latitude: null, longitude: null } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', input.itemId).eq('reporter_id', input.reporterId).select('id').maybeSingle();
  return { error: error?.message ?? (data ? null : 'Could not find a report you own to update.') };
}

export async function fetchOwnItemVerificationAttributes(itemId: string): Promise<{
  attributes: { key: string; value: string }[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('item_verification_attributes')
    .select('attribute_key, attribute_value, created_at')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true });
  return {
    attributes: ((data ?? []) as Pick<ItemVerificationAttribute, 'attribute_key' | 'attribute_value'>[]).map((row) => ({
      key: row.attribute_key,
      value: row.attribute_value,
    })),
    error: error?.message ?? null,
  };
}

export async function replaceOwnItemVerificationAttributes(
  itemId: string,
  attributes: { key: string; value: string }[]
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('replace_own_item_verification_attributes', {
    p_item_id: itemId,
    p_attributes: attributes.map(({ key, value }) => ({ key: key.trim(), value: value.trim() })),
  });
  return { error: error?.message ?? null };
}
