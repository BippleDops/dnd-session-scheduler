'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getCharacterDetail, getCharacterSessions, getCharacterLoot, getCharacterJournals, addCharacterJournal, type CharacterSheet, type CharacterSessionEntry, type LootEntry, type JournalEntry } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import VisualCharacterSheet from '@/components/ui/CharacterSheet';
import CandleLoader from '@/components/ui/CandleLoader';
import WoodButton from '@/components/ui/WoodButton';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';

const RARITY_COLORS: Record<string, string> = {
  Common: 'text-gray-400', Uncommon: 'text-green-400', Rare: 'text-blue-400',
  'Very Rare': 'text-purple-400', Legendary: 'text-orange-400',
};

export default function CharacterDetailPage() { return <Suspense><CharacterDetailInner /></Suspense>; }

function CharacterDetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [char, setChar] = useState<CharacterSheet | null>(null);
  const [sessions, setSessions] = useState<CharacterSessionEntry[]>([]);
  const [loot, setLoot] = useState<LootEntry[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [tab, setTab] = useState<'sheet' | 'history' | 'inventory' | 'journals'>('sheet');
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [journalTitle, setJournalTitle] = useState('');
  const [journalContent, setJournalContent] = useState('');

  usePageTitle(char?.name || 'Character');

  useEffect(() => {
    if (!id) return;
    getCharacterDetail(id).then(setChar);
    getCharacterSessions(id).then(setSessions);
    getCharacterLoot(id).then(setLoot);
    getCharacterJournals(id).then(setJournals).catch(() => {});
  }, [id]);

  const handleJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalContent.trim()) return;
    try {
      await addCharacterJournal(id, { title: journalTitle, content: journalContent });
      toast('Journal entry saved!', 'success');
      setShowJournalForm(false);
      setJournalTitle('');
      setJournalContent('');
      getCharacterJournals(id).then(setJournals);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  if (!char) return <CandleLoader text="Loading character..." />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Characters', href: '/characters' }, { label: char.name }]} />

      {/* Visual Character Sheet */}
      <VisualCharacterSheet character={char} />

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          ['sheet', '📋 Details'],
          ['history', `📖 Sessions (${sessions.length})`],
          ['inventory', `🎒 Loot (${loot.length})`],
          ['journals', `📜 Journals (${journals.length})`],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded text-sm font-[var(--font-heading)] transition-colors whitespace-nowrap ${
              tab === key ? 'bg-[var(--gold)] text-[var(--wood-dark)]' :
              'bg-[var(--wood-dark)] text-[var(--parchment-dark)] hover:bg-[var(--wood-light)]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'sheet' && char.backstory && (
        <ParchmentPanel title="📖 Backstory">
          <p className="text-sm whitespace-pre-wrap leading-relaxed italic">{char.backstory}</p>
        </ParchmentPanel>
      )}

      {tab === 'history' && (
        <ParchmentPanel title={`Session History (${sessions.length})`}>
          {sessions.length === 0 ? (
            <p className="text-[var(--ink-faded)] text-center py-4 italic">No sessions yet. Sign up for an adventure!</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s, i) => (
                <a key={i} href={`/session?id=${s.session_id}`} className="flex justify-between items-center p-3 rounded bg-[rgba(0,0,0,0.03)] hover:bg-[rgba(201,169,89,0.05)] transition-colors no-underline card-enter" style={{ animationDelay: `${i * 40}ms` }}>
                  <div>
                    <span className="text-sm font-bold text-[var(--ink)]">{s.title || s.campaign}</span>
                    <span className="text-xs text-[var(--ink-faded)] ml-2">{s.campaign}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded ${s.status === 'Completed' ? 'bg-green-100 text-green-700' : s.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-[var(--parchment-dark)] text-[var(--ink)]'}`}>{s.status}</span>
                    <span className="text-xs text-[var(--ink-faded)]">{formatDate(s.date)}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </ParchmentPanel>
      )}

      {tab === 'inventory' && (
        <ParchmentPanel title={`Inventory (${loot.length} items)`}>
          {loot.length === 0 ? (
            <p className="text-[var(--ink-faded)] text-center py-4 italic">No loot acquired yet. Adventure awaits!</p>
          ) : (
            <div className="space-y-2">
              {loot.map(l => (
                <div key={l.loot_id} className="flex justify-between items-center p-3 rounded bg-[rgba(0,0,0,0.03)]">
                  <div>
                    <span className={`text-sm font-bold ${RARITY_COLORS[l.rarity] || 'text-[var(--ink)]'}`}>{l.item_name}</span>
                    {l.description && <p className="text-xs text-[var(--ink-faded)] mt-0.5">{l.description}</p>}
                  </div>
                  <div className="text-right text-xs flex-shrink-0">
                    <span className={RARITY_COLORS[l.rarity] || ''}>{l.rarity}</span>
                    {l.quantity > 1 && <span className="ml-1 text-[var(--ink-faded)]">×{l.quantity}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ParchmentPanel>
      )}

      {tab === 'journals' && (
        <div className="space-y-4">
          {isLoggedIn && (
            showJournalForm ? (
              <ParchmentPanel title="✍️ New Journal Entry">
                <form onSubmit={handleJournalSubmit} className="space-y-3">
                  <input className="tavern-input" placeholder="Entry title (optional)" value={journalTitle} onChange={e => setJournalTitle(e.target.value)} />
                  <textarea className="tavern-input h-32" placeholder="Write from your character's perspective..." value={journalContent} onChange={e => setJournalContent(e.target.value)} required />
                  <div className="flex gap-2 justify-end">
                    <WoodButton variant="secondary" onClick={() => setShowJournalForm(false)}>Cancel</WoodButton>
                    <WoodButton variant="primary" type="submit">Save Entry</WoodButton>
                  </div>
                </form>
              </ParchmentPanel>
            ) : (
              <WoodButton onClick={() => setShowJournalForm(true)}>✍️ Write Journal Entry</WoodButton>
            )
          )}
          {journals.length === 0 ? (
            <ParchmentPanel><p className="text-[var(--ink-faded)] text-center py-4 italic">No journal entries yet. Chronicle your adventures!</p></ParchmentPanel>
          ) : journals.map(j => (
            <ParchmentPanel key={j.journal_id}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-[var(--font-heading)] text-lg text-[var(--gold)]">{j.title || 'Untitled Entry'}</h3>
                <span className="text-[10px] text-[var(--ink-faded)]">{j.created_at}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed italic">{j.content}</p>
              {j.dm_comment && (
                <div className="mt-3 p-2 bg-[rgba(201,169,89,0.1)] rounded text-sm">
                  <span className="font-semibold text-[var(--gold)]">DM:</span> {j.dm_comment}
                </div>
              )}
            </ParchmentPanel>
          ))}
        </div>
      )}
    </div>
  );
}
