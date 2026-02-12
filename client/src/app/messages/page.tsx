'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getMyMessages, sendMessage, markMessageRead, getMyContacts, type Message } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';

export default function MessagesPage() {
  usePageTitle('Messages');
  const { isLoggedIn, loading: authLoading, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [form, setForm] = useState({ toPlayerId: '', subject: '', body: '' });
  const [selected, setSelected] = useState<Message | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    Promise.all([getMyMessages(), getMyContacts()]).then(([m, p]) => {
      setMessages(m);
      setPlayers(p);
    }).finally(() => setLoading(false));
  }, [isLoggedIn]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(form);
    setShowCompose(false);
    setForm({ toPlayerId: '', subject: '', body: '' });
    getMyMessages().then(setMessages);
  };

  const openMessage = async (m: Message) => {
    setSelected(m);
    if (!m.read) {
      await markMessageRead(m.message_id);
      setMessages(prev => prev.map(msg => msg.message_id === m.message_id ? { ...msg, read: 1 } : msg));
    }
  };

  if (authLoading) return <CandleLoader text="Checking credentials..." />;
  if (!isLoggedIn) return <ParchmentPanel title="Sign In Required"><p>Please sign in to view messages.</p></ParchmentPanel>;
  if (loading) return <CandleLoader text="Loading messages..." />;

  const unread = messages.filter(m => !m.read && m.to_name === user?.name).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">📨 Messages {unread > 0 && <span className="text-sm bg-red-600 text-white px-2 py-0.5 rounded-full">{unread}</span>}</h1>
        <WoodButton onClick={() => setShowCompose(!showCompose)}>{showCompose ? 'Cancel' : '✉️ Compose'}</WoodButton>
      </div>

      {showCompose && (
        <ParchmentPanel title="New Message">
          <form onSubmit={handleSend} className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1">To</label>
              <select required className="parchment-input w-full" value={form.toPlayerId} onChange={e => setForm({ ...form, toPlayerId: e.target.value })}>
                <option value="">Select player...</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Subject</label>
              <input className="parchment-input w-full" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Message</label>
              <textarea required className="parchment-input w-full h-24" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
            </div>
            <WoodButton type="submit">Send</WoodButton>
          </form>
        </ParchmentPanel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Message list */}
        <div className="md:col-span-1 space-y-1">
          {messages.length === 0 ? (
            <ParchmentPanel><p className="text-[var(--ink-faded)] text-center">No messages.</p></ParchmentPanel>
          ) : messages.map(m => (
            <button key={m.message_id} onClick={() => openMessage(m)}
              className={`w-full text-left p-3 rounded transition-colors ${selected?.message_id === m.message_id ? 'bg-[var(--gold)]/20 border border-[var(--gold)]' : 'bg-[var(--wood-dark)] hover:bg-[var(--wood)]'} ${!m.read ? 'font-bold' : ''}`}>
              <div className="flex justify-between">
                <span className="text-sm text-[var(--gold)] truncate">{m.from_name}</span>
                <span className="text-[10px] text-[var(--ink-faded)]">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-[var(--parchment-dark)] truncate">{m.subject || '(no subject)'}</p>
            </button>
          ))}
        </div>

        {/* Message detail */}
        <div className="md:col-span-2">
          {selected ? (
            <ParchmentPanel title={selected.subject || '(no subject)'}>
              <div className="flex justify-between text-xs text-[var(--ink-faded)] mb-3">
                <span>From: {selected.from_name} → {selected.to_name}</span>
                <span>{new Date(selected.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap">{selected.body}</p>
            </ParchmentPanel>
          ) : (
            <ParchmentPanel><p className="text-[var(--ink-faded)] text-center">Select a message to read.</p></ParchmentPanel>
          )}
        </div>
      </div>
    </div>
  );
}

