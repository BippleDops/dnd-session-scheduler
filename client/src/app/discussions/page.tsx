'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getDiscussions, createThread, getThread, replyToThread, adminThread, getCampaignsList, type DiscussionThread, type DiscussionThreadDetail, type Campaign } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';

export default function DiscussionsPage() { return <Suspense><DiscussionsInner /></Suspense>; }

function DiscussionsInner() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('campaign') || '';
  const threadId = searchParams.get('thread') || '';
  const { isLoggedIn, isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(slug);
  const [threads, setThreads] = useState<DiscussionThread[]>([]);
  const [activeThread, setActiveThread] = useState<DiscussionThreadDetail | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCampaignsList().then(setCampaigns); }, []);
  useEffect(() => {
    if (!selectedSlug) { setLoading(false); return; }
    setLoading(true);
    getDiscussions(selectedSlug).then(setThreads).finally(() => setLoading(false));
  }, [selectedSlug]);
  useEffect(() => { if (threadId) getThread(threadId).then(setActiveThread); }, [threadId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newContent) return;
    await createThread(selectedSlug, { title: newTitle, content: newContent });
    setShowNew(false); setNewTitle(''); setNewContent('');
    getDiscussions(selectedSlug).then(setThreads);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText || !activeThread) return;
    await replyToThread(activeThread.thread_id, replyText);
    setReplyText('');
    getThread(activeThread.thread_id).then(setActiveThread);
  };

  const openThread = (t: DiscussionThread) => { getThread(t.thread_id).then(setActiveThread); };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">💬 Discussion Boards</h1>
        <select className="parchment-input" value={selectedSlug} onChange={e => { setSelectedSlug(e.target.value); setActiveThread(null); }}>
          <option value="">Select campaign...</option>
          {campaigns.map(c => <option key={c.campaign_id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      {!selectedSlug ? (
        <ParchmentPanel><p className="text-[var(--ink-faded)] text-center">Select a campaign to view discussions.</p></ParchmentPanel>
      ) : loading ? <CandleLoader text="Loading..." /> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Thread list */}
          <div className="space-y-2">
            {isLoggedIn && <WoodButton onClick={() => setShowNew(!showNew)} className="w-full">{showNew ? 'Cancel' : '+ New Thread'}</WoodButton>}
            {showNew && (
              <form onSubmit={handleCreate} className="space-y-2">
                <input required className="parchment-input w-full" placeholder="Thread title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <textarea required className="parchment-input w-full h-20" placeholder="First post..." value={newContent} onChange={e => setNewContent(e.target.value)} />
                <WoodButton type="submit">Post</WoodButton>
              </form>
            )}
            {threads.length === 0 ? (
              <ParchmentPanel><p className="text-[var(--ink-faded)] text-center text-sm">No discussions yet.</p></ParchmentPanel>
            ) : threads.map(t => (
              <button key={t.thread_id} onClick={() => openThread(t)}
                className={`w-full text-left p-3 rounded transition-colors ${activeThread?.thread_id === t.thread_id ? 'bg-[var(--gold)]/20 border border-[var(--gold)]' : 'bg-[var(--wood-dark)] hover:bg-[var(--wood)]'}`}>
                <div className="flex items-center gap-1">
                  {t.pinned ? <span title="Pinned">📌</span> : null}
                  {t.locked ? <span title="Locked">🔒</span> : null}
                  <span className="font-bold text-sm truncate">{t.title}</span>
                </div>
                <div className="flex justify-between text-[10px] text-[var(--ink-faded)] mt-1">
                  <span>{t.author_name}</span>
                  <span>{t.post_count} posts</span>
                </div>
              </button>
            ))}
          </div>

          {/* Thread detail */}
          <div className="md:col-span-2">
            {activeThread ? (
              <ParchmentPanel title={activeThread.title}>
                {isAdmin && (
                  <div className="flex gap-2 mb-3">
                    <WoodButton variant="sm" onClick={() => adminThread(activeThread.thread_id, { pinned: !activeThread.pinned }).then(() => getThread(activeThread.thread_id).then(setActiveThread))}>{activeThread.pinned ? 'Unpin' : 'Pin'}</WoodButton>
                    <WoodButton variant="sm" onClick={() => adminThread(activeThread.thread_id, { locked: !activeThread.locked }).then(() => getThread(activeThread.thread_id).then(setActiveThread))}>{activeThread.locked ? 'Unlock' : 'Lock'}</WoodButton>
                  </div>
                )}
                <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                  {activeThread.posts.map(p => (
                    <div key={p.post_id} className="p-3 bg-[var(--wood-dark)] rounded">
                      <div className="flex items-center gap-2 mb-1">
                        {p.author_photo && <img src={p.author_photo} alt="" className="w-6 h-6 rounded-full" />}
                        <span className="text-sm font-bold text-[var(--gold)]">{p.author_name}</span>
                        <span className="text-[10px] text-[var(--ink-faded)]">{new Date(p.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{p.content}</p>
                    </div>
                  ))}
                </div>
                {!activeThread.locked && isLoggedIn && (
                  <form onSubmit={handleReply} className="flex gap-2">
                    <textarea className="parchment-input flex-1 h-16" placeholder="Reply..." value={replyText} onChange={e => setReplyText(e.target.value)} />
                    <WoodButton type="submit">Reply</WoodButton>
                  </form>
                )}
              </ParchmentPanel>
            ) : (
              <ParchmentPanel><p className="text-[var(--ink-faded)] text-center">Select a thread to read.</p></ParchmentPanel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

