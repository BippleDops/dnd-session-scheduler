'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getCharacterDetail, getCharacterSessions, getCharacterLoot, type CharacterSheet, type CharacterSessionEntry, type LootEntry } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import CandleLoader from '@/components/ui/CandleLoader';

const RARITY_COLORS: Record<string, string> = {
  Common: 'text-gray-300', Uncommon: 'text-green-400', Rare: 'text-blue-400',
  'Very Rare': 'text-purple-400', Legendary: 'text-orange-400',
};

export default function CharacterDetailPage() { return <Suspense><CharacterDetailInner /></Suspense>; }
function CharacterDetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';
  const [char, setChar] = useState<CharacterSheet | null>(null);
  const [sessions, setSessions] = useState<CharacterSessionEntry[]>([]);
  const [loot, setLoot] = useState<LootEntry[]>([]);
  const [tab, setTab] = useState<'sheet' | 'history' | 'inventory'>('sheet');

  useEffect(() => {
    if (!id) return;
    getCharacterDetail(id).then(setChar);
    getCharacterSessions(id).then(setSessions);
    getCharacterLoot(id).then(setLoot);
  }, [id]);

  if (!char) return <CandleLoader text="Loading character..." />;

  const mod = (v: number) => { const m = Math.floor((v - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; };

  return (
    <div className="space-y-6">
      {/* Header */}
      <ParchmentPanel>
        <div className="flex flex-col md:flex-row gap-6">
          {char.portrait_url ? (
            <img src={char.portrait_url} alt={char.name} className="w-32 h-32 rounded-lg object-cover border-2 border-[var(--wood-dark)]" />
          ) : (
            <div className="w-32 h-32 rounded-lg bg-[var(--wood-dark)] flex items-center justify-center text-5xl">⚔️</div>
          )}
          <div className="flex-1">
            <h1 className="font-[var(--font-heading)] text-3xl text-[var(--gold)]">{char.name}</h1>
            <p className="text-lg text-[var(--parchment-dark)]">{char.race} {char.class}{char.subclass ? ` — ${char.subclass}` : ''}</p>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-[var(--gold)]">Level {char.level}</span>
              <span>❤️ {char.hp}/{char.max_hp}</span>
              <span>🛡️ AC {char.ac}</span>
              <span className={char.status === 'Active' ? 'text-green-400' : 'text-red-400'}>{char.status}</span>
            </div>
            <div className="flex gap-2 mt-2 text-xs text-[var(--ink-faded)]">
              <span>💰 {char.gold}g {char.silver}s {char.copper}c</span>
            </div>
          </div>
        </div>
      </ParchmentPanel>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['sheet', 'history', 'inventory'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm font-[var(--font-heading)] transition-colors ${tab === t ? 'bg-[var(--gold)] text-[var(--wood-dark)]' : 'bg-[var(--wood)] text-[var(--parchment-dark)] hover:bg-[var(--wood-light)]'}`}>
            {t === 'sheet' ? '📋 Sheet' : t === 'history' ? '📖 History' : '🎒 Inventory'}
          </button>
        ))}
      </div>

      {tab === 'sheet' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ability Scores */}
          <ParchmentPanel title="Ability Scores">
            <div className="grid grid-cols-3 gap-4">
              {[['STR', char.str], ['DEX', char.dex], ['CON', char.con], ['INT', char.int_], ['WIS', char.wis], ['CHA', char.cha]].map(([label, val]) => (
                <div key={label as string} className="text-center p-3 border border-[var(--wood-dark)] rounded">
                  <span className="block text-xs text-[var(--ink-faded)] uppercase">{label as string}</span>
                  <span className="block text-2xl font-bold text-[var(--gold)]">{val as number}</span>
                  <span className="block text-sm text-[var(--parchment)]">{mod(val as number)}</span>
                </div>
              ))}
            </div>
          </ParchmentPanel>

          {/* Details */}
          <div className="space-y-4">
            {char.proficiencies && (
              <ParchmentPanel title="Proficiencies">
                <p className="text-sm whitespace-pre-wrap">{char.proficiencies}</p>
              </ParchmentPanel>
            )}
            {char.equipment && (
              <ParchmentPanel title="Equipment">
                <p className="text-sm whitespace-pre-wrap">{char.equipment}</p>
              </ParchmentPanel>
            )}
          </div>

          {/* Backstory */}
          {char.backstory && (
            <ParchmentPanel title="Backstory" className="col-span-full">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{char.backstory}</p>
            </ParchmentPanel>
          )}
        </div>
      )}

      {tab === 'history' && (
        <ParchmentPanel title={`Session History (${sessions.length})`}>
          {sessions.length === 0 ? (
            <p className="text-[var(--ink-faded)] text-center">No sessions yet.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s, i) => (
                <div key={i} className="flex justify-between items-center p-2 border-b border-[var(--wood-dark)] last:border-0">
                  <div>
                    <span className="text-sm font-bold">{s.title || s.campaign}</span>
                    <span className="text-xs text-[var(--ink-faded)] ml-2">{s.campaign}</span>
                  </div>
                  <span className="text-xs text-[var(--ink-faded)]">{s.date}</span>
                </div>
              ))}
            </div>
          )}
        </ParchmentPanel>
      )}

      {tab === 'inventory' && (
        <ParchmentPanel title={`Inventory (${loot.length} items)`}>
          {loot.length === 0 ? (
            <p className="text-[var(--ink-faded)] text-center">No loot acquired yet.</p>
          ) : (
            <div className="space-y-2">
              {loot.map(l => (
                <div key={l.loot_id} className="flex justify-between items-center p-2 border-b border-[var(--wood-dark)] last:border-0">
                  <div>
                    <span className={`text-sm font-bold ${RARITY_COLORS[l.rarity] || ''}`}>{l.item_name}</span>
                    {l.description && <p className="text-xs text-[var(--ink-faded)]">{l.description}</p>}
                  </div>
                  <div className="text-right text-xs">
                    <span className={RARITY_COLORS[l.rarity] || ''}>{l.rarity}</span>
                    {l.quantity > 1 && <span className="ml-1">x{l.quantity}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ParchmentPanel>
      )}
    </div>
  );
}
