'use client';
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';
import { useToast } from '@/components/ui/Toast';

interface Monster { monster_id: string; name: string; size: string; type: string; ac: number; hp: number; challenge_rating: number; xp: number; actions: string; str: number; dex: number; con: number; int_: number; wis: number; cha: number; }
interface DifficultyResult { difficulty: string; adjustedXP: number; totalXP: number; multiplier: number; thresholds: { easy: number; medium: number; hard: number; deadly: number } }

const DIFF_COLORS: Record<string, string> = { Trivial: 'text-gray-400', Easy: 'text-green-400', Medium: 'text-yellow-400', Hard: 'text-orange-400', Deadly: 'text-red-500' };

const BASE = process.env.NEXT_PUBLIC_API_URL || '';
async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, { credentials: 'include', ...opts, headers: { 'Content-Type': 'application/json', ...opts?.headers } });
  return res.json();
}

export default function EncounterBuilderPage() {
  usePageTitle('Encounter Builder');
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [encounter, setEncounter] = useState<{ monster: Monster; count: number }[]>([]);
  const [partyLevels, setPartyLevels] = useState('3,3,3,3');
  const [difficulty, setDifficulty] = useState<DifficultyResult | null>(null);
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);

  const searchMonsters = async (q: string) => {
    setSearch(q);
    if (q.length < 1) { setMonsters([]); return; }
    const results = await fetchJson<Monster[]>(`/api/admin/monsters?q=${encodeURIComponent(q)}`);
    setMonsters(results);
  };

  const addToEncounter = (m: Monster) => {
    const existing = encounter.find(e => e.monster.monster_id === m.monster_id);
    if (existing) { existing.count++; setEncounter([...encounter]); }
    else { setEncounter([...encounter, { monster: m, count: 1 }]); }
    calculateDifficulty([...encounter, ...(existing ? [] : [{ monster: m, count: 1 }])]);
  };

  const removeFromEncounter = (monsterId: string) => {
    setEncounter(encounter.filter(e => e.monster.monster_id !== monsterId));
  };

  const calculateDifficulty = async (enc?: typeof encounter) => {
    const e = enc || encounter;
    const levels = partyLevels.split(',').map(l => parseInt(l.trim(), 10)).filter(l => l > 0);
    if (levels.length === 0 || e.length === 0) { setDifficulty(null); return; }
    const monsterXPs: number[] = [];
    for (const entry of e) { for (let i = 0; i < entry.count; i++) monsterXPs.push(entry.monster.xp); }
    const result = await fetchJson<DifficultyResult>('/api/admin/encounter/calculate', { method: 'POST', body: JSON.stringify({ partyLevels: levels, monsterXPs }) });
    setDifficulty(result);
  };

  if (!isAdmin) return <ParchmentPanel title="Access Denied"><p>Admin only.</p></ParchmentPanel>;

  const totalMonsters = encounter.reduce((a, e) => a + e.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">⚔️ Encounter Builder</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monster search */}
        <div className="space-y-4">
          <ParchmentPanel title="🔍 Monster Database">
            <input className="tavern-input mb-3" placeholder="Search monsters..." value={search} onChange={e => searchMonsters(e.target.value)} />
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {monsters.map(m => (
                <button key={m.monster_id} onClick={() => setSelectedMonster(m)}
                  className="w-full text-left p-2 rounded bg-[rgba(0,0,0,0.03)] hover:bg-[rgba(201,169,89,0.08)] transition-colors flex justify-between items-center">
                  <div>
                    <span className="text-sm font-semibold text-[var(--ink)]">{m.name}</span>
                    <span className="text-[10px] text-[var(--ink-faded)] ml-2">{m.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--ink-faded)]">CR {m.challenge_rating}</span>
                    <WoodButton variant="sm" onClick={(e) => { e.stopPropagation(); addToEncounter(m); }}>+</WoodButton>
                  </div>
                </button>
              ))}
              {search && monsters.length === 0 && <p className="text-xs text-[var(--ink-faded)] text-center py-2">No monsters found.</p>}
            </div>
          </ParchmentPanel>

          {/* Monster detail */}
          {selectedMonster && (
            <ParchmentPanel title={`📋 ${selectedMonster.name}`}>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div>AC: <strong>{selectedMonster.ac}</strong></div>
                <div>HP: <strong>{selectedMonster.hp}</strong></div>
                <div>CR: <strong>{selectedMonster.challenge_rating}</strong></div>
                <div>XP: <strong>{selectedMonster.xp}</strong></div>
              </div>
              <div className="grid grid-cols-6 gap-1 text-center text-[10px] mb-2">
                {[['STR', selectedMonster.str], ['DEX', selectedMonster.dex], ['CON', selectedMonster.con], ['INT', selectedMonster.int_], ['WIS', selectedMonster.wis], ['CHA', selectedMonster.cha]].map(([l,v]) => (
                  <div key={l as string}><span className="block font-bold">{v as number}</span><span className="text-[var(--ink-faded)]">{l as string}</span></div>
                ))}
              </div>
              {selectedMonster.actions && <p className="text-xs text-[var(--ink-faded)]">{selectedMonster.actions}</p>}
              <WoodButton variant="primary" className="mt-2 w-full" onClick={() => addToEncounter(selectedMonster)}>Add to Encounter</WoodButton>
            </ParchmentPanel>
          )}
        </div>

        {/* Encounter composition */}
        <div className="lg:col-span-2 space-y-4">
          <ParchmentPanel title="⚔️ Encounter">
            <div className="mb-3">
              <label className="text-xs font-bold text-[var(--ink)] block mb-1">Party Levels (comma-separated)</label>
              <div className="flex gap-2">
                <input className="tavern-input flex-1" value={partyLevels} onChange={e => setPartyLevels(e.target.value)} placeholder="3,3,4,5" />
                <WoodButton onClick={() => calculateDifficulty()}>Calculate</WoodButton>
              </div>
            </div>

            {/* Difficulty result */}
            {difficulty && (
              <div className="p-4 rounded bg-[rgba(0,0,0,0.05)] mb-4">
                <div className="flex justify-between items-center">
                  <span className={`font-[var(--font-heading)] text-2xl ${DIFF_COLORS[difficulty.difficulty] || ''}`}>
                    {difficulty.difficulty}
                  </span>
                  <span className="text-sm text-[var(--ink-faded)]">{difficulty.adjustedXP} adjusted XP ({totalMonsters} monsters, ×{difficulty.multiplier})</span>
                </div>
                <div className="flex gap-4 mt-2 text-[10px]">
                  {Object.entries(difficulty.thresholds).map(([k, v]) => (
                    <span key={k} className={DIFF_COLORS[k.charAt(0).toUpperCase() + k.slice(1)] || ''}>{k}: {v} XP</span>
                  ))}
                </div>
              </div>
            )}

            {encounter.length === 0 ? (
              <p className="text-center text-[var(--ink-faded)] py-6 italic">Search for monsters and add them to build your encounter.</p>
            ) : (
              <div className="space-y-2">
                {encounter.map(e => (
                  <div key={e.monster.monster_id} className="flex justify-between items-center p-3 rounded bg-[rgba(0,0,0,0.03)]">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-[var(--gold)] w-8 text-center">×{e.count}</span>
                      <div>
                        <span className="font-semibold text-[var(--ink)]">{e.monster.name}</span>
                        <span className="text-xs text-[var(--ink-faded)] ml-2">CR {e.monster.challenge_rating} · {e.monster.hp} HP · AC {e.monster.ac}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { e.count++; setEncounter([...encounter]); calculateDifficulty(); }} className="px-2 py-1 bg-[var(--parchment-dark)] rounded text-xs">+</button>
                      <button onClick={() => { if (e.count > 1) { e.count--; setEncounter([...encounter]); calculateDifficulty(); } else removeFromEncounter(e.monster.monster_id); }} className="px-2 py-1 bg-[var(--parchment-dark)] rounded text-xs">−</button>
                      <button onClick={() => removeFromEncounter(e.monster.monster_id)} className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ParchmentPanel>
        </div>
      </div>
    </div>
  );
}
