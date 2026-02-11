'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getMyHomework, updateHomework, type HomeworkEntry } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import CandleLoader from '@/components/ui/CandleLoader';
import Link from 'next/link';

export default function HomeworkPage() {
  const { isLoggedIn } = useAuth();
  const [entries, setEntries] = useState<HomeworkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) return;
    getMyHomework().then(setEntries).finally(() => setLoading(false));
  }, [isLoggedIn]);

  const toggle = async (sessionId: string, field: string, current: number) => {
    await updateHomework(sessionId, { [field]: current ? 0 : 1 });
    getMyHomework().then(setEntries);
  };

  if (!isLoggedIn) return <ParchmentPanel title="Sign In Required"><p>Please sign in.</p></ParchmentPanel>;
  if (loading) return <CandleLoader text="Loading homework..." />;

  return (
    <div className="space-y-6">
      <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">📝 Between-Session Homework</h1>

      {entries.length === 0 ? (
        <ParchmentPanel><p className="text-[var(--ink-faded)] text-center">No homework assigned yet. Complete sessions to see tasks here!</p></ParchmentPanel>
      ) : entries.map(h => {
        const tasks = [
          { key: 'recap_read', label: 'Read the session recap', link: '/recaps', val: h.recap_read },
          { key: 'journal_written', label: 'Write a character journal entry', link: '/characters', val: h.journal_written },
          { key: 'downtime_submitted', label: 'Submit a downtime action', link: '/downtime', val: h.downtime_submitted },
          { key: 'character_updated', label: 'Update your character (level up, etc.)', link: '/characters', val: h.character_updated },
        ];
        const done = tasks.filter(t => t.val).length;
        const pct = Math.round((done / tasks.length) * 100);

        return (
          <ParchmentPanel key={h.session_id}>
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="font-bold">{h.title || h.campaign}</span>
                <span className="text-sm text-[var(--parchment-dark)] ml-2">{h.date}</span>
              </div>
              <span className={`text-sm font-bold ${pct === 100 ? 'text-green-400' : 'text-[var(--gold)]'}`}>{pct === 100 ? '✓ Complete' : `${done}/${tasks.length}`}</span>
            </div>
            <div className="h-2 bg-[var(--wood-dark)] rounded overflow-hidden mb-3">
              <div className={`h-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-[var(--gold)]'}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="space-y-1">
              {tasks.map(t => (
                <div key={t.key} className="flex items-center justify-between">
                  <button onClick={() => toggle(h.session_id, t.key, t.val)}
                    className={`flex items-center gap-2 text-sm ${t.val ? 'text-green-400' : 'text-[var(--parchment-dark)]'}`}>
                    {t.val ? '✅' : '⬜'} {t.label}
                  </button>
                  <Link href={t.link} className="text-[10px] text-[var(--gold)] hover:underline">Go →</Link>
                </div>
              ))}
            </div>
          </ParchmentPanel>
        );
      })}
    </div>
  );
}

