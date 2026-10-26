import { supabase } from './supabase';
import {
  excludeAlreadyMatched,
  filterVisibleMatches,
  rankMatches,
  type MatchCandidate,
} from './matching';
import type { Item, ItemMatchWithItems } from '../types/database';

function toCandidate(item: Pick<
  Item,
  'id' | 'reporter_id' | 'category' | 'title' | 'description' | 'color' | 'item_datetime' | 'latitude' | 'longitude'
>): MatchCandidate {
  return {
    id: item.id,
    reporterId: item.reporter_id,
    category: item.category,
    title: item.title,
    description: item.description,
    color: item.color,
    itemDatetime: item.item_datetime,
    latitude: item.latitude,
    longitude: item.longitude,
  };
}

export interface RunMatchingResult {
  matchesFound: number;
  error: string | null;
}

/**
 * Runs the deterministic matching engine for a single newly created (or
 * refreshed) report against every active report of the opposite type, and
 * records any STRONG/POSSIBLE matches via the record_match RPC. Safe to call
 * repeatedly — duplicate pairs are prevented both by an already-matched
 * exclusion pass here and by a unique constraint in the database.
 */
export async function runMatchingForItem(item: Item): Promise<RunMatchingResult> {
  if (item.status !== 'ACTIVE') {
    return { matchesFound: 0, error: null };
  }

  const oppositeType = item.report_type === 'LOST' ? 'FOUND' : 'LOST';

  const { data: candidateRows, error: candidatesError } = await supabase
    .from('items')
    .select('id, reporter_id, category, title, description, color, item_datetime, latitude, longitude')
    .eq('report_type', oppositeType)
    .eq('status', 'ACTIVE')
    .neq('reporter_id', item.reporter_id);

  if (candidatesError) {
    return { matchesFound: 0, error: candidatesError.message };
  }

  const matchColumn = item.report_type === 'LOST' ? 'lost_item_id' : 'found_item_id';
  const { data: existingMatches, error: existingError } = await supabase
    .from('item_matches')
    .select('lost_item_id, found_item_id')
    .eq(matchColumn, item.id);

  if (existingError) {
    return { matchesFound: 0, error: existingError.message };
  }

  const alreadyMatchedIds = (existingMatches ?? []).map((m) =>
    item.report_type === 'LOST' ? m.found_item_id : m.lost_item_id
  );

  const candidates = excludeAlreadyMatched((candidateRows ?? []).map(toCandidate), alreadyMatchedIds);

  const source = toCandidate(item);
  const results = filterVisibleMatches(rankMatches(source, candidates));

  let matchesFound = 0;
  for (const result of results) {
    const lostItemId = item.report_type === 'LOST' ? item.id : result.candidateItemId;
    const foundItemId = item.report_type === 'FOUND' ? item.id : result.candidateItemId;

    const { error: rpcError } = await supabase.rpc('record_match', {
      p_lost_item_id: lostItemId,
      p_found_item_id: foundItemId,
      p_score: result.score,
      p_reasons: result.reasons,
      p_distance_meters: result.distanceMeters,
      p_time_difference_minutes: result.timeDifferenceMinutes,
    });

    if (!rpcError) {
      matchesFound += 1;
    }
  }

  return { matchesFound, error: null };
}

export interface FetchMatchesResult {
  matches: ItemMatchWithItems[];
  error: string | null;
}

/** Loads every match the current user participates in, both sides populated. */
export async function fetchMyMatches(): Promise<FetchMatchesResult> {
  const { data, error } = await supabase
    .from('item_matches')
    .select('*, lost:items!item_matches_lost_item_id_fkey(*, item_images(*)), found:items!item_matches_found_item_id_fkey(*, item_images(*))')
    .order('score', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return { matches: [], error: error.message };
  }

  return { matches: (data ?? []) as unknown as ItemMatchWithItems[], error: null };
}

export async function rejectMatch(matchId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('reject_match', { p_match_id: matchId });
  return { error: error?.message ?? null };
}

export async function requestMatchVerification(matchId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('request_match_verification', { p_match_id: matchId });
  return { error: error?.message ?? null };
}

export async function getVerificationQuestions(
  matchId: string
): Promise<{ questions: { key: string; attemptsUsed: number }[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_verification_questions', { p_match_id: matchId });
  if (error) return { questions: [], error: error.message };
  const questions = ((data ?? []) as { attribute_key: string; attempts_used: number }[]).map((row) => ({
    key: row.attribute_key,
    attemptsUsed: row.attempts_used,
  }));
  return { questions, error: null };
}

export async function submitVerificationAnswer(
  matchId: string,
  attributeKey: string,
  answer: string
): Promise<{ correct: boolean; error: string | null }> {
  const { data, error } = await supabase.rpc('submit_verification_answer', {
    p_match_id: matchId,
    p_attribute_key: attributeKey,
    p_answer: answer,
  });
  if (error) return { correct: false, error: error.message };
  return { correct: Boolean(data), error: null };
}

export async function fetchVerificationAttempts(
  matchId: string
): Promise<{ attempts: { attribute_key: string; is_correct: boolean; attempts_used: number }[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_verification_review', { p_match_id: matchId });

  if (error) return { attempts: [], error: error.message };
  return { attempts: (data ?? []) as { attribute_key: string; is_correct: boolean; attempts_used: number }[], error: null };
}

export async function finalizeVerification(
  matchId: string,
  decision: 'VERIFIED' | 'REJECTED'
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('finalize_verification', {
    p_match_id: matchId,
    p_decision: decision,
  });
  return { error: error?.message ?? null };
}

export async function advanceRecovery(
  matchId: string,
  status: 'RECOVERY_IN_PROGRESS' | 'HANDOFF_SCHEDULED' | 'RECOVERED'
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('advance_recovery', { p_match_id: matchId, p_status: status });
  return { error: error?.message ?? null };
}

export async function scheduleHandoff(
  matchId: string,
  scheduledAt: string,
  location: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('schedule_handoff', {
    p_match_id: matchId,
    p_scheduled_at: scheduledAt,
    p_location: location,
  });
  return { error: error?.message ?? null };
}
