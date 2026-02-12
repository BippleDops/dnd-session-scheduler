'use client';
import { useState, useCallback, useEffect } from 'react';

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

interface RollResult {
  expression: string;
  results: number[];
  total: number;
  modifier: number;
  player_name?: string;
  created_at?: string;
}

interface Props {
  sessionId?: string;
}

export function DiceRoller({ sessionId }: Props) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<RollResult[]>([]);
  const [customExpr, setCustomExpr] = useState('');

  const rollDice = useCallback(async (expression: string) => {
    setRolling(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${base}/api/dice/roll`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression, sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        setHistory(prev => [data, ...prev].slice(0, 20));
      }
    } catch { /* ignore */ }
    setRolling(false);
  }, [sessionId]);

  const handleDie = (die: string) => {
    const mod = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : '';
    rollDice(`${count}${die}${mod}`);
  };

  const handleCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customExpr) rollDice(customExpr);
  };

  return (
    <>
      {/* Floating dice button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-[1500] w-14 h-14 rounded-full bg-[var(--gold)] text-[var(--wood-dark)] text-2xl shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
        title="Dice Roller"
        aria-label={open ? 'Close dice roller' : 'Open dice roller'}
      >
        🎲
      </button>

      {/* Dice tray */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[1500] w-80 max-h-[70vh] overflow-y-auto bg-[var(--wood)] border-2 border-[var(--gold)] rounded-lg shadow-2xl">
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-[var(--font-heading)] text-lg text-[var(--gold)]">🎲 Dice Tray</h3>
              <button onClick={() => setOpen(false)} className="text-[var(--parchment-dark)] hover:text-white text-lg">✕</button>
            </div>

            {/* Count + modifier */}
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="text-[10px] text-[var(--ink-faded)] block">Count</label>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCount(Math.max(1, count - 1))} className="px-2 py-1 bg-[var(--wood-dark)] rounded text-xs">−</button>
                  <span className="text-center flex-1 font-bold">{count}</span>
                  <button onClick={() => setCount(Math.min(20, count + 1))} className="px-2 py-1 bg-[var(--wood-dark)] rounded text-xs">+</button>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[var(--ink-faded)] block">Modifier</label>
                <div className="flex items-center gap-1">
                  <button onClick={() => setModifier(modifier - 1)} className="px-2 py-1 bg-[var(--wood-dark)] rounded text-xs">−</button>
                  <span className="text-center flex-1 font-bold">{modifier >= 0 ? `+${modifier}` : modifier}</span>
                  <button onClick={() => setModifier(modifier + 1)} className="px-2 py-1 bg-[var(--wood-dark)] rounded text-xs">+</button>
                </div>
              </div>
            </div>

            {/* Dice buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {DICE.map(d => (
                <button key={d} onClick={() => handleDie(d)} disabled={rolling}
                  className={`py-2 rounded font-bold text-sm transition-all ${rolling ? 'opacity-50' : 'hover:scale-105 hover:bg-[var(--gold)] hover:text-[var(--wood-dark)]'} bg-[var(--wood-dark)] text-[var(--parchment)]`}>
                  {d}
                </button>
              ))}
            </div>

            {/* Custom */}
            <form onSubmit={handleCustom} className="flex gap-1 mb-3">
              <input className="parchment-input flex-1 text-xs" placeholder="Custom: 2d6+3" value={customExpr} onChange={e => setCustomExpr(e.target.value)} />
              <button type="submit" disabled={rolling} className="px-3 py-1 bg-[var(--gold)] text-[var(--wood-dark)] rounded text-xs font-bold">Roll</button>
            </form>

            {/* Results */}
            {history.length > 0 && (
              <div className="border-t border-[var(--wood-dark)] pt-2">
                <h4 className="text-xs text-[var(--ink-faded)] mb-1">Roll History</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {history.map((r, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-1 rounded bg-[var(--wood-dark)]">
                      <div>
                        {r.player_name && <span className="text-[var(--gold)] mr-1">{r.player_name}</span>}
                        <span className="text-[var(--parchment-dark)]">{r.expression}</span>
                        <span className="text-[var(--ink-faded)] ml-1">[{r.results.join(', ')}]{r.modifier ? (r.modifier > 0 ? `+${r.modifier}` : r.modifier) : ''}</span>
                      </div>
                      <span className="font-bold text-[var(--gold)] text-sm">{r.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

