'use client';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { getInitiativeEntries, addInitiativeEntry, updateInitiativeEntry, deleteInitiativeEntry, clearInitiative, getDiceHistory, getSessionComments, postSessionComment, type InitiativeEntry, type DiceRoll, type Comment } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSSEContext } from '@/hooks/useSSEContext';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';

const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious','Concentrating'];

export default function LiveSessionPage() { return <Suspense><LiveSessionInner /></Suspense>; }

function LiveSessionInner() {
  usePageTitle('Live Session');
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') || '';
  const { isAdmin } = useAuth();
  const { setSessionId, subscribe, presence } = useSSEContext();
  const [entries, setEntries] = useState<InitiativeEntry[]>([]);
  const [diceHistory, setDiceHistory] = useState<DiceRoll[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [addForm, setAddForm] = useState({ name: '', initiative: '', hp: '', maxHp: '', isNpc: false });
  const [commentText, setCommentText] = useState('');

  const loadData = useCallback(() => {
    if (!sessionId) return;
    getInitiativeEntries(sessionId).then(setEntries);
    getDiceHistory(sessionId).then(setDiceHistory);
    getSessionComments(sessionId).then(setComments);
  }, [sessionId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Connect shared SSE to this session
  useEffect(() => {
    if (!sessionId) return;
    setSessionId(sessionId);
    return () => setSessionId(null);
  }, [sessionId, setSessionId]);

  // Subscribe to SSE events via shared context
  useEffect(() => {
    if (!sessionId) return;
    const unsub1 = subscribe('initiative_update', (data) => {
      setEntries(data as InitiativeEntry[]);
    });
    const unsub2 = subscribe('dice_roll', (data) => {
      setDiceHistory(prev => [data as DiceRoll, ...prev].slice(0, 30));
    });
    return () => { unsub1(); unsub2(); };
  }, [sessionId, subscribe]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    await addInitiativeEntry(sessionId, addForm);
    setAddForm({ name: '', initiative: '', hp: '', maxHp: '', isNpc: false });
    loadData();
  };

  const handleDamage = async (entry: InitiativeEntry, amount: number) => {
    await updateInitiativeEntry(entry.entry_id, { hp: Math.max(0, entry.hp + amount) });
  };

  const toggleCondition = async (entry: InitiativeEntry, condition: string) => {
    const current: string[] = Array.isArray(entry.conditions) ? entry.conditions : [];
    const next = current.includes(condition) ? current.filter(c => c !== condition) : [...current, condition];
    await updateInitiativeEntry(entry.entry_id, { conditions: next });
  };

  const nextTurn = () => {
    const next = currentTurn + 1;
    if (next >= entries.length) { setCurrentTurn(0); setRound(r => r + 1); }
    else setCurrentTurn(next);
  };

  const prevTurn = () => {
    if (currentTurn === 0 && round > 1) { setCurrentTurn(entries.length - 1); setRound(r => r - 1); }
    else setCurrentTurn(Math.max(0, currentTurn - 1));
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await postSessionComment(sessionId, commentText);
    setCommentText('');
    loadData();
  };

  if (!sessionId) return <ParchmentPanel title="Error"><p>No session ID provided.</p></ParchmentPanel>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">⚔️ Live Session</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-green-400">● {presence} online</span>
          <span className="text-[var(--gold)]">Round {round}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Initiative Tracker — main column */}
        <div className="lg:col-span-2 space-y-4">
          <ParchmentPanel title="Initiative Order">
            {isAdmin && entries.length > 0 && (
              <div className="flex gap-2 mb-4">
                <WoodButton onClick={prevTurn} variant="secondary">◀ Prev</WoodButton>
                <WoodButton onClick={nextTurn}>Next ▶</WoodButton>
                <WoodButton onClick={() => clearInitiative(sessionId).then(loadData)} variant="secondary">Clear All</WoodButton>
              </div>
            )}

            {entries.length === 0 ? (
              <p className="text-[var(--ink-faded)] text-center py-4">No combatants. Add entries below.</p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry, i) => {
                  const isCurrent = i === currentTurn;
                  const hpPct = entry.max_hp > 0 ? Math.round((entry.hp / entry.max_hp) * 100) : 100;
                  const conditions: string[] = Array.isArray(entry.conditions) ? entry.conditions : [];
                  return (
                    <div key={entry.entry_id} className={`p-3 rounded border-2 transition-all ${isCurrent ? 'border-[var(--gold)] bg-[var(--gold)]/10' : 'border-[var(--wood-dark)] bg-[var(--wood-dark)]'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {isCurrent && <span className="text-[var(--gold)] animate-pulse">▶</span>}
                          <span className="font-bold text-lg">{entry.name}</span>
                          <span className="text-[var(--gold)] text-sm">Init: {entry.initiative}</span>
                          {entry.is_npc ? <span className="text-xs bg-red-900/30 text-red-400 px-1 rounded">NPC</span> : null}
                        </div>
                        {isAdmin && (
                          <button onClick={() => deleteInitiativeEntry(entry.entry_id).then(loadData)} className="text-red-400 text-xs hover:text-red-300" aria-label={`Remove ${entry.name}`}>✕</button>
                        )}
                      </div>

                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span>❤️ {entry.hp}/{entry.max_hp}</span>
                          <span>{hpPct}%</span>
                        </div>
                        <div className="h-2 bg-[var(--wood)] rounded overflow-hidden" role="progressbar" aria-valuenow={entry.hp} aria-valuemax={entry.max_hp} aria-label={`${entry.name} health`}>
                          <div className={`h-full transition-all ${hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${hpPct}%` }} />
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 mt-1">
                            {[-10, -5, -1, 1, 5, 10].map(n => (
                              <button key={n} onClick={() => handleDamage(entry, n)}
                                aria-label={`${n > 0 ? 'Heal' : 'Damage'} ${entry.name} by ${Math.abs(n)}`}
                                className={`text-xs px-2 py-0.5 rounded ${n < 0 ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                                {n > 0 ? `+${n}` : n}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {(conditions.length > 0 || isAdmin) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {isAdmin ? CONDITIONS.map(c => (
                            <button key={c} onClick={() => toggleCondition(entry, c)}
                              aria-pressed={conditions.includes(c)}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${conditions.includes(c) ? 'bg-purple-700 text-white' : 'bg-[var(--wood)] text-[var(--ink-faded)]'}`}>
                              {c}
                            </button>
                          )) : conditions.map(c => (
                            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-700 text-white">{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isAdmin && (
              <form onSubmit={handleAddEntry} className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
                <input required placeholder="Name" className="parchment-input" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
                <input type="number" placeholder="Init" className="parchment-input" value={addForm.initiative} onChange={e => setAddForm({ ...addForm, initiative: e.target.value })} />
                <input type="number" placeholder="HP" className="parchment-input" value={addForm.hp} onChange={e => setAddForm({ ...addForm, hp: e.target.value })} />
                <input type="number" placeholder="Max HP" className="parchment-input" value={addForm.maxHp} onChange={e => setAddForm({ ...addForm, maxHp: e.target.value })} />
                <div className="flex gap-1">
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={addForm.isNpc} onChange={e => setAddForm({ ...addForm, isNpc: e.target.checked })} /> NPC</label>
                  <WoodButton type="submit">Add</WoodButton>
                </div>
              </form>
            )}
          </ParchmentPanel>
        </div>

        {/* Sidebar: dice history + chat */}
        <div className="space-y-4">
          <ParchmentPanel title="🎲 Dice Rolls">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {diceHistory.length === 0 ? (
                <p className="text-xs text-[var(--ink-faded)] text-center">No rolls yet. Use the dice tray!</p>
              ) : diceHistory.map((r, i) => (
                <div key={i} className="flex justify-between text-xs p-1 bg-[var(--wood-dark)] rounded">
                  <span><span className="text-[var(--gold)]">{r.player_name}</span> {r.expression}</span>
                  <span className="font-bold text-[var(--gold)]">{r.total}</span>
                </div>
              ))}
            </div>
          </ParchmentPanel>

          <ParchmentPanel title="💬 Session Chat">
            <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
              {comments.length === 0 ? (
                <p className="text-xs text-[var(--ink-faded)] text-center">No messages yet.</p>
              ) : comments.map(c => (
                <div key={c.comment_id} className="text-xs">
                  <span className="text-[var(--gold)] font-bold">{c.player_name}: </span>
                  <span>{c.text}</span>
                </div>
              ))}
            </div>
            <form onSubmit={handleComment} className="flex gap-1">
              <input className="parchment-input flex-1 text-xs" placeholder="Message..." value={commentText} onChange={e => setCommentText(e.target.value)} />
              <WoodButton type="submit">Send</WoodButton>
            </form>
          </ParchmentPanel>
        </div>
      </div>
    </div>
  );
}
