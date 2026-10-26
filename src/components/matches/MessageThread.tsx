import { useEffect, useRef, useState } from 'react';
import { useMatchMessages } from '../../hooks/useMatchMessages';
import { Spinner } from '../ui/Spinner';
import { formatDateTime } from '../../utils/date';

interface MessageThreadProps {
  matchId: string;
  currentUserId: string;
  canSend: boolean;
}

export function MessageThread({ matchId, currentUserId, canSend }: MessageThreadProps) {
  const { messages, loading, sending, send } = useMatchMessages(matchId, currentUserId);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const { error: sendError } = await send(draft);
    if (sendError) {
      setError(sendError);
      return;
    }
    setError(null);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate">
        Messages here are only ever visible to the two of you and stay tied to this recovery —
        no need to share your personal email or phone number.
      </p>

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-paper/50 p-3">
        {loading ? (
          <Spinner label="Loading messages…" />
        ) : messages.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-light">No messages yet. Say hello!</p>
        ) : (
          messages.map((message) => {
            const isMine = message.sender_id === currentUserId;
            return (
              <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    isMine ? 'bg-signal text-white' : 'bg-white border border-border text-ink'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p className={`mt-1 text-[10px] ${isMine ? 'text-white/70' : 'text-slate-light'}`}>
                    {formatDateTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message…"
            maxLength={2000}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:border-signal"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-50"
          >
            Send
          </button>
        </form>
      ) : (
        <p className="text-xs text-slate-light">
          Messaging opens once the finder confirms they found the item.
        </p>
      )}
      {error && <p className="text-xs text-coral-dark">{error}</p>}
    </div>
  );
}
