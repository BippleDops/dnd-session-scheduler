'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getSession, getSessionComments, postSessionComment, type Session, type Comment } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WaxSeal from '@/components/ui/WaxSeal';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';
import TierShield from '@/components/ui/TierShield';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { useToast } from '@/components/ui/Toast';

export default function SessionDetailPage() { return <Suspense><SessionDetailInner /></Suspense>; }

function SessionDetailInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('id') || '';
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');

  usePageTitle(session?.title || 'Session');

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId).then(setSession);
    getSessionComments(sessionId).then(setComments);
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

  if (!session) return <CandleLoader text="Loading session..." />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Sessions', href: '/sessions' }, { label: session.title || session.campaign }]} />

      {/* Session info */}
      <ParchmentPanel>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-[var(--font-heading)] text-2xl text-[var(--ink)]">{session.title || session.campaign}</h1>
            <p className="text-sm text-[var(--ink-faded)]">{formatDate(session.date)} · {formatTime(session.startTime)} — {formatTime(session.endTime)}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {session.levelTier && session.levelTier !== 'any' && <TierShield tier={session.levelTier} size="md" />}
              {session.location && <span className="text-xs text-[var(--ink-faded)]">📍 {session.location}</span>}
              <span className="text-xs text-[var(--ink-faded)]">{session.registeredCount} / {session.maxPlayers} adventurers</span>
            </div>
          </div>
          <WaxSeal campaign={session.campaign} size={48} />
        </div>
        {session.description && <p className="mt-3 text-sm text-[var(--ink-faded)] italic">{session.description}</p>}
      </ParchmentPanel>

      {/* DM's Pre-Session Note */}
      {session.preSessionNote && (
        <ParchmentPanel>
          <h3 className="font-[var(--font-heading)] text-sm text-[var(--gold)] mb-2">📋 DM&apos;s Note</h3>
          <p className="text-sm text-[var(--ink)] whitespace-pre-wrap">{session.preSessionNote}</p>
        </ParchmentPanel>
      )}

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

      {/* Comments */}
      <ParchmentPanel title={`💬 Discussion (${comments.length})`}>
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
