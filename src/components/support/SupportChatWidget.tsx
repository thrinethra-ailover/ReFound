import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import {
  fetchSupportChatEnabled,
  fetchSupportMessages,
  getOrCreateSupportConversation,
  removeSupportChatChannel,
  sendSupportMessage,
  watchSupportConversation,
} from '../../lib/supportChatService';
import type { AdminSupportMessage } from '../../types/database';

export function SupportChatWidget() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || authLoading || adminLoading || isAdmin) return;
    let active = true;
    const refreshStatus = async () => {
      const result = await fetchSupportChatEnabled();
      if (active) setEnabled(result.enabled);
    };
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user, authLoading, adminLoading, isAdmin]);

  useEffect(() => {
    if (!open || !conversationId) return;
    let active = true;
    const refreshMessages = async () => {
      const result = await fetchSupportMessages(conversationId);
      if (active) {
        setMessages(result.messages);
        if (result.error) setError('Could not refresh the conversation. Please try again.');
      }
    };
    void refreshMessages();
    const channel = watchSupportConversation(conversationId, () => void refreshMessages());
    return () => {
      active = false;
      void removeSupportChatChannel(channel);
    };
  }, [open, conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, open]);

  if (!user || authLoading || adminLoading || isAdmin || !enabled) return null;

  const openChat = async () => {
    setOpen(true);
    setPaused(false);
    setError(null);
    if (conversationId) return;
    setOpening(true);
    const status = await fetchSupportChatEnabled();
    if (!status.enabled) {
      setEnabled(false);
      setPaused(true);
      setOpening(false);
      return;
    }
    const result = await getOrCreateSupportConversation(user.id);
    if (!result.conversationId) {
      setError('Could not open support chat. Please try again in a moment.');
      setOpening(false);
      return;
    }
    setConversationId(result.conversationId);
    const history = await fetchSupportMessages(result.conversationId);
    setMessages(history.messages);
    if (history.error) setError('Could not load the conversation. Please try again.');
    setOpening(false);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!conversationId || !draft.trim() || sending || !enabled) return;
    setSending(true);
    setError(null);
    const result = await sendSupportMessage(conversationId, user.id, draft);
    if (result.error || !result.message) {
      const status = await fetchSupportChatEnabled();
      if (!status.enabled) {
        setEnabled(false);
        setPaused(true);
      } else {
        setError('Your message could not be sent. Please try again.');
      }
    } else {
      setMessages((current) => [...current, result.message!]);
      setDraft('');
    }
    setSending(false);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      {open && (
        <section className="mb-3 flex h-[min(34rem,calc(100vh-8rem))] w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-card-hover" aria-label="Chat with ReFound admin">
          <header className="flex items-center justify-between bg-ink px-4 py-3 text-white">
            <div>
              <h2 className="text-sm font-bold">Chat with ReFound admin</h2>
              <p className="text-xs text-white/70">Private support conversation</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-xl leading-none text-white/80 hover:bg-white/10" aria-label="Close support chat">×</button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-paper p-3" aria-live="polite">
            {paused && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">The admin has paused support chat for now. You can still read this conversation.</p>}
            {opening ? <p className="py-8 text-center text-sm text-slate">Opening your conversation…</p> : messages.length === 0 ? (
              <p className="rounded-xl border border-border bg-white p-3 text-sm text-slate">Send a message whenever you need help. The admin will reply here.</p>
            ) : messages.map((message) => {
              const mine = message.sender_id === user.id;
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? 'bg-signal text-white' : 'border border-border bg-white text-ink'}`}>
                    <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                    <time className={`mt-1 block text-right text-[10px] ${mine ? 'text-white/70' : 'text-slate-light'}`} dateTime={message.created_at}>
                      {new Date(message.created_at).toLocaleString()}
                    </time>
                  </div>
                </div>
              );
            })}
            {error && <p className="text-xs text-coral-dark" role="alert">{error}</p>}
            <div ref={endRef} />
          </div>
          <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-border bg-white p-3">
            <label className="sr-only" htmlFor="support-chat-message">Message the admin</label>
            <textarea id="support-chat-message" value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} rows={2} maxLength={2000} placeholder={enabled ? 'Write a message…' : 'Chat is paused'} disabled={!enabled || opening} className="min-w-0 flex-1 resize-none rounded-xl border border-border px-3 py-2 text-sm text-ink outline-none focus:border-signal disabled:bg-paper" />
            <button type="submit" disabled={!enabled || opening || sending || !draft.trim()} className="self-end rounded-xl bg-signal px-3 py-2 text-sm font-semibold text-white hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-50">{sending ? '…' : 'Send'}</button>
          </form>
        </section>
      )}
      <button type="button" onClick={() => open ? setOpen(false) : void openChat()} className="ml-auto flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-sm font-bold text-white shadow-card-hover transition-transform hover:scale-[1.03]" aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-3.5 2V6.5A2.5 2.5 0 0 1 6 4h6.5A7.5 7.5 0 0 1 20 11.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
        {open ? 'Close chat' : 'Chat with admin'}
      </button>
    </div>
  );
}
