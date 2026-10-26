import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchSupportChatEnabled,
  fetchSupportConversations,
  fetchSupportMessages,
  removeSupportChatChannel,
  sendSupportMessage,
  setSupportChatEnabled,
  watchAdminSupportInbox,
} from '../../lib/supportChatService';
import type { AdminSupportConversation, AdminSupportMessage } from '../../types/database';

export function AdminSupportChatTab() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conversations, setConversations] = useState<AdminSupportConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadConversations = useCallback(async () => {
    const result = await fetchSupportConversations();
    if (result.error) setError(result.error);
    else {
      setConversations(result.conversations);
      setError(null);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const result = await fetchSupportMessages(conversationId);
    if (result.error) setError(result.error);
    else setMessages(result.messages);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [status, inbox] = await Promise.all([fetchSupportChatEnabled(), fetchSupportConversations()]);
      if (!active) return;
      if (status.error) setError(status.error);
      else setEnabled(status.enabled);
      if (inbox.error) setError(inbox.error);
      else {
        setConversations(inbox.conversations);
        setSelectedId((current) => current ?? inbox.conversations[0]?.id ?? null);
      }
      setLoading(false);
    }
    void load();
    const channel = watchAdminSupportInbox(() => {
      void loadConversations();
      if (selectedId) void loadMessages(selectedId);
    });
    return () => {
      active = false;
      void removeSupportChatChannel(channel);
    };
  }, [loadConversations, loadMessages, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await setSupportChatEnabled(next);
    setSaving(false);
    if (result.error) {
      setEnabled(!next);
      setError(result.error);
    } else {
      setSaved(true);
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !user || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const result = await sendSupportMessage(selectedId, user.id, draft);
    if (result.error || !result.message) setError(result.error ?? 'Could not send the reply.');
    else {
      setMessages((current) => [...current, result.message!]);
      setDraft('');
      await loadConversations();
    }
    setSending(false);
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">User support chat</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate">Let signed-in users send you private messages from anywhere in ReFound. Each user has one ongoing thread. Turning chat off hides it from users and blocks new messages; you can still read and reply to existing threads.</p>
          </div>
          <button type="button" role="switch" aria-checked={enabled} aria-label="Enable user support chat" disabled={loading || saving} onClick={() => void toggle()} className={`relative box-border h-7 w-12 shrink-0 rounded-full p-0 transition-colors disabled:opacity-50 ${enabled ? 'bg-signal' : 'bg-slate-light'}`}>
            <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm" aria-live="polite">
          <span className={`font-semibold ${enabled ? 'text-emerald-700' : 'text-slate'}`}>{loading ? 'Loading…' : enabled ? 'Enabled for users' : 'Paused'}</span>
          {saving && <span className="text-slate">Saving…</span>}
          {saved && <span className="text-emerald-700">Setting saved.</span>}
        </div>
      </div>

      <div className="grid min-h-[32rem] overflow-hidden rounded-2xl border border-border bg-white shadow-sm md:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-b border-border md:border-b-0 md:border-r" aria-label="Support conversations">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold text-ink">Inbox <span className="text-slate">({conversations.length})</span></h3>
          </div>
          <div className="max-h-64 overflow-y-auto md:max-h-[32rem]">
            {loading ? <p className="p-4 text-sm text-slate">Loading conversations…</p> : conversations.length === 0 ? <p className="p-4 text-sm text-slate">No support messages yet.</p> : conversations.map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => setSelectedId(conversation.id)} className={`block w-full border-b border-border px-4 py-3 text-left hover:bg-paper ${selectedId === conversation.id ? 'bg-paper' : ''}`}>
                <span className="block truncate text-sm font-semibold text-ink">{conversation.user_name}</span>
                <span className="mt-0.5 block truncate text-xs text-slate">{conversation.campus_email || conversation.user_id}</span>
                <time className="mt-1 block text-[11px] text-slate-light" dateTime={conversation.updated_at}>{new Date(conversation.updated_at).toLocaleString()}</time>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-h-[24rem] flex-col">
          {selectedId ? (
            <>
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-bold text-ink">{conversations.find((item) => item.id === selectedId)?.user_name ?? 'Conversation'}</h3>
                <p className="text-xs text-slate">Messages update live.</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-paper p-4" aria-live="polite">
                {messages.length === 0 ? <p className="text-sm text-slate">This user hasn’t sent a message yet.</p> : messages.map((message) => {
                  const mine = message.sender_id === user?.id;
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? 'bg-signal text-white' : 'border border-border bg-white text-ink'}`}>
                        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                        <time className={`mt-1 block text-right text-[10px] ${mine ? 'text-white/70' : 'text-slate-light'}`} dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-border p-3">
                <label className="sr-only" htmlFor="admin-support-reply">Reply to user</label>
                <textarea id="admin-support-reply" value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} rows={2} maxLength={2000} placeholder="Write a reply…" className="min-w-0 flex-1 resize-none rounded-xl border border-border px-3 py-2 text-sm text-ink outline-none focus:border-signal" />
                <button type="submit" disabled={!draft.trim() || sending} className="self-end rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-soft disabled:opacity-50">{sending ? '…' : 'Reply'}</button>
              </form>
            </>
          ) : <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate">Select a conversation to read and reply.</div>}
          {error && <p className="border-t border-border px-4 py-2 text-sm text-coral-dark" role="alert">{error}</p>}
        </div>
      </div>
    </section>
  );
}
