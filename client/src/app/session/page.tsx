'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getSession, getSessionComments, postSessionComment, getPlayerRecaps, submitPlayerRecap, getSessionMoments, type Session, type Comment, type PlayerRecap, type SessionMoment } from '@/lib/api';
import { formatDate, formatTime, campaignColor } from '@/lib/utils';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WaxSeal from '@/components/ui/WaxSeal';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';
import { useToast } from '@/components/ui/Toast';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

export default function SessionDetailPage() { return <Suspense><SessionDetailInner /></Suspense>; }

function SessionDetailInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('id') || '';
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [recaps, setRecaps] = useState<PlayerRecap[]>([]);
  const [moments, setMoments] = useState<SessionMoment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [recapText, setRecapText] = useState('');
  const [showRecapForm, setShowRecapForm] = useState(false);
  const [tab, setTab] = useState<'details' | 'recaps' | 'comments'>('details');

  usePageTitle(session?.title || 'Session');

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId).then(setSession);
    getSessionComments(sessionId).then(setComments);
    getPlayerRecaps(sessionId).then(setRecaps).catch(() => {});
    getSessionMoments(sessionId).then(setMoments).catch(() => {});
  }, [sessionId]);

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await postSessionComment(sessionId, commentText);
      setCommentText('');
      getSessionComments(sessionId).then(setComments);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  const handleRecap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recapText.trim()) return;
    try {
      await submitPlayerRecap(sessionId, recapText);
      toast('Recap submitted!', 'success');
      setRecapText('');
      setShowRecapForm(false);
      getPlayerRecaps(sessionId).then(setRecaps);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  if (!session) return <CandleLoader text="Loading session..." />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Sessions', href: '/sessions' }, { label: session.title || session.campaign }]} />

      {/* Header */}
      <ParchmentPanel>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-[var(--font-heading)] text-2xl text-[var(--ink)]">{session.title || session.campaign}</h1>
            <p className="text-sm text-[var(--ink-faded)]">{formatDate(session.date)} · {formatTime(session.startTime)} — {formatTime(session.endTime)}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[var(--ink-faded)]">{session.registeredCount} / {session.maxPlayers} adventurers</span>
              {session.location && <span className="text-xs text-[var(--ink-faded)]">📍 {session.location}</span>}
            </div>
          </div>
          <WaxSeal campaign={session.campaign} size={48} />
        </div>
        {session.description && <p className="mt-3 text-sm text-[var(--ink-faded)] italic">{session.description}</p>}
      </ParchmentPanel>

      {/* Roster */}
      {session.roster.length > 0 && (
        <ParchmentPanel title="⚔️ Adventuring Party">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {session.roster.map((r, i) => (
              <div key={i} className="flex justify-between items-center p-2 bg-[rgba(0,0,0,0.03)] rounded">
                <span className="font-semibold text-[var(--ink)]">{r.characterName}</span>
                <span className="text-xs text-[var(--ink-faded)]">{r.characterClass} Lv.{r.characterLevel}</span>
              </div>
            ))}
          </div>
        </ParchmentPanel>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(['details', 'recaps', 'comments'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm font-[var(--font-heading)] transition-colors ${
              tab === t ? 'bg-[var(--gold)] text-[var(--wood-dark)]' :
              'bg-[var(--wood-dark)] text-[var(--parchment-dark)] hover:bg-[var(--wood-light)]'
            }`}>
            {t === 'details' ? `📜 Moments${moments.length > 0 ? ` (${moments.length})` : ''}` :
             t === 'recaps' ? `📖 Recaps (${recaps.length})` :
             `💬 Comments (${comments.length})`}
          </button>
        ))}
      </div>

      {/* Moments */}
      {tab === 'details' && (
        <ParchmentPanel>
          {moments.length === 0 ? (
            <p className="text-center text-[var(--ink-faded)] italic py-4">No moments recorded for this session yet.</p>
          ) : (
            <div className="space-y-3">
              {moments.map(m => {
                const icons: Record<string, string> = { combat_start: '⚔️', combat_end: '🏳️', key_moment: '⭐', break: '☕', loot_drop: '💰', plot_reveal: '🔮', note: '📝' };
                return (
                  <div key={m.moment_id} className="flex gap-3 items-start">
                    <span className="text-lg flex-shrink-0">{icons[m.type] || '📌'}</span>
                    <div>
                      <p className="text-sm text-[var(--ink)]">{m.description}</p>
                      <p className="text-[10px] text-[var(--ink-faded)]">{m.timestamp}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ParchmentPanel>
      )}

      {/* Player Recaps */}
      {tab === 'recaps' && (
        <div className="space-y-4">
          {isLoggedIn && (
            <div>
              {showRecapForm ? (
                <ParchmentPanel title="Write Your Recap">
                  <form onSubmit={handleRecap} className="space-y-3">
                    <p className="text-xs text-[var(--ink-faded)]">How did your character experience this session? Write from their perspective.</p>
                    <textarea className="tavern-input h-32" value={recapText} onChange={e => setRecapText(e.target.value)} placeholder="As the dungeon door creaked open, my character..." required />
                    <div className="flex gap-2 justify-end">
                      <WoodButton variant="secondary" onClick={() => setShowRecapForm(false)}>Cancel</WoodButton>
                      <WoodButton variant="primary" type="submit">Submit Recap</WoodButton>
                    </div>
                  </form>
                </ParchmentPanel>
              ) : (
                <WoodButton onClick={() => setShowRecapForm(true)}>📖 Write Your Recap</WoodButton>
              )}
            </div>
          )}
          {recaps.length === 0 ? (
            <ParchmentPanel><p className="text-center text-[var(--ink-faded)] italic py-4">No player recaps yet. Be the first to tell the tale!</p></ParchmentPanel>
          ) : recaps.map(r => (
            <ParchmentPanel key={r.recap_id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-[var(--gold)]">{r.player_name || 'Anonymous'}</span>
                <span className="text-[10px] text-[var(--ink-faded)]">{r.created_at}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.content}</p>
            </ParchmentPanel>
          ))}
        </div>
      )}

      {/* Comments */}
      {tab === 'comments' && (
        <ParchmentPanel>
          <div className="space-y-3 mb-4">
            {comments.length === 0 ? (
              <p className="text-center text-[var(--ink-faded)] italic py-4">No comments yet.</p>
            ) : comments.map(c => (
              <div key={c.comment_id} className="p-2 bg-[rgba(0,0,0,0.03)] rounded">
                <div className="flex items-center gap-2">
                  {c.photo_url && <img src={c.photo_url} alt="" className="w-6 h-6 rounded-full" />}
                  <span className="text-sm font-semibold text-[var(--ink)]">{c.player_name}</span>
                  <span className="text-[10px] text-[var(--ink-faded)]">{c.created_at}</span>
                </div>
                <p className="text-sm mt-1">{c.text}</p>
              </div>
            ))}
          </div>
          {isLoggedIn && (
            <form onSubmit={handleComment} className="flex gap-2">
              <input className="tavern-input flex-1" placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} />
              <WoodButton type="submit">Send</WoodButton>
            </form>
          )}
        </ParchmentPanel>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <WoodButton variant="sm" onClick={() => window.location.href = `/api/sessions/${session.sessionId}/ics`}>📅 Add to Calendar</WoodButton>
        {session.spotsRemaining > 0 && session.status === 'Scheduled' && (
          <WoodButton variant="primary" href={`/signup?sessionId=${session.sessionId}`}>Sign Up</WoodButton>
        )}
      </div>
    </div>
  );
}
