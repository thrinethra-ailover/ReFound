import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchMatchMessages, sendMatchMessage } from '../lib/messageService';
import type { MatchMessage } from '../types/database';

export function useMatchMessages(matchId: string, currentUserId: string | undefined) {
  const [messages, setMessages] = useState<MatchMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { messages: data } = await fetchMatchMessages(matchId);
      if (!cancelled) {
        setMessages(data);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // Feature 5: new messages appear without a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`match_messages:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          setMessages((prev) => {
            const incoming = payload.new as MatchMessage;
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  const send = async (body: string) => {
    if (!currentUserId) return { error: 'Not signed in.' };
    setSending(true);
    const { error } = await sendMatchMessage(matchId, currentUserId, body);
    setSending(false);
    return { error };
  };

  return { messages, loading, sending, send };
}
