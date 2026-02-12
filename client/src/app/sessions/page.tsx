'use client';
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getSessions } from '@/lib/api';
import CandleLoader from '@/components/ui/CandleLoader';
import { SessionGridSkeleton } from '@/components/ui/SessionSkeleton';
import QuestCard from '@/components/ui/QuestCard';
import WoodButton from '@/components/ui/WoodButton';

export default function SessionsPage() {
  usePageTitle('Sessions');
  const { data: sessions, loading } = useApi(getSessions);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const feedUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/feed.ics` : '';

  if (loading) return <SessionGridSkeleton />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="scroll-heading text-3xl">📜 Upcoming Sessions</h1>
        <WoodButton variant="sm" onClick={() => setShowSubscribe(!showSubscribe)}>📅 Subscribe to Calendar</WoodButton>
      </div>

      {showSubscribe && (
        <div className="parchment p-4 mb-4">
          <p className="text-sm text-[var(--ink)] mb-2">Paste this URL into Google Calendar, Apple Calendar, or Outlook:</p>
          <input
            type="text"
            readOnly
            value={feedUrl}
            className="tavern-input text-center text-sm"
            onClick={e => { (e.target as HTMLInputElement).select(); navigator.clipboard.writeText(feedUrl); }}
          />
          <p className="text-xs text-[var(--ink-faded)] mt-1 text-center">
            Or <a href={feedUrl.replace('https://', 'webcal://').replace('http://', 'webcal://')} className="text-[var(--gold)] underline">open in your calendar app</a>
          </p>
        </div>
      )}

      {(!sessions || sessions.length === 0) ? (
        <div className="parchment p-10 text-center">
          <p className="font-[var(--font-heading)] text-xl text-[var(--ink)]">No sessions on the schedule right now.</p>
          <p className="text-[var(--ink-faded)] italic mt-2">The tavern keeper says check back soon!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map(s => <QuestCard key={s.sessionId} session={s} />)}
        </div>
      )}
    </div>
  );
}

