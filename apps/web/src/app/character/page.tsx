'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getCharacterDetail, getCharacterSessions, type CharacterSheet, type CharacterSessionEntry } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import CandleLoader from '@/components/ui/CandleLoader';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { formatDate } from '@/lib/utils';

export default function CharacterDetailPage() { return <Suspense><CharacterDetailInner /></Suspense>; }

function CharacterDetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';
  const [char, setChar] = useState<CharacterSheet | null>(null);
  const [sessions, setSessions] = useState<CharacterSessionEntry[]>([]);

  usePageTitle(char?.name || 'Character');

  useEffect(() => {
    if (!id) return;
    getCharacterDetail(id).then(setChar);
    getCharacterSessions(id).then(setSessions);
  }, [id]);

  if (!char) return <CandleLoader text="Loading character..." />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Characters', href: '/characters' }, { label: char.name }]} />

      {/* Character info */}
      <ParchmentPanel>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg bg-[var(--wood-dark)] flex items-center justify-center text-3xl">
            {({ Barbarian: '🪓', Bard: '🎵', Cleric: '✝️', Druid: '🌿', Fighter: '⚔️', Monk: '👊', Paladin: '🛡️', Ranger: '🏹', Rogue: '🗡️', Sorcerer: '✨', Warlock: '👁️', Wizard: '🧙', Artificer: '⚙️' } as Record<string, string>)[char.class?.split(',')[0]?.trim()] || '⚔️'}
          </div>
          <div>
            <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">{char.name}</h1>
            <p className="text-sm text-[var(--ink-faded)]">
              {char.race} {char.class}{char.subclass ? ` — ${char.subclass}` : ''} · Level {char.level}
            </p>
            <span className={`text-xs font-semibold ${char.status === 'Active' ? 'text-green-600' : 'text-red-600'}`}>{char.status}</span>
          </div>
        </div>
      </ParchmentPanel>

      {/* Session history */}
      <ParchmentPanel title={`📖 Session History (${sessions.length})`}>
        {sessions.length === 0 ? (
          <p className="text-[var(--ink-faded)] text-center py-4 italic">No sessions yet. Sign up for an adventure!</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s, i) => (
              <a key={i} href={`/session?id=${s.session_id}`}
                className="flex justify-between items-center p-3 rounded bg-[rgba(0,0,0,0.03)] hover:bg-[rgba(201,169,89,0.05)] transition-colors no-underline">
                <div>
                  <span className="text-sm font-bold text-[var(--ink)]">{s.title || s.campaign}</span>
                  <span className="text-xs text-[var(--ink-faded)] ml-2">{s.campaign}</span>
                </div>
                <span className="text-xs text-[var(--ink-faded)]">{formatDate(s.date)}</span>
              </a>
            ))}
          </div>
        )}
      </ParchmentPanel>
    </div>
  );
}
