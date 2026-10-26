import { supabase } from './supabase';
import type { MatchMessage } from '../types/database';

export async function fetchMatchMessages(
  matchId: string
): Promise<{ messages: MatchMessage[]; error: string | null }> {
  const { data, error } = await supabase
    .from('match_messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  if (error) return { messages: [], error: error.message };
  return { messages: (data ?? []) as MatchMessage[], error: null };
}

export async function sendMatchMessage(
  matchId: string,
  senderId: string,
  body: string
): Promise<{ error: string | null }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: 'Message cannot be empty.' };

  const { error } = await supabase
    .from('match_messages')
    .insert({ match_id: matchId, sender_id: senderId, body: trimmed });

  return { error: error?.message ?? null };
}
