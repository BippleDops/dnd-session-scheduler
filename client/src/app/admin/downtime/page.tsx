'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAdminDowntime, resolveDowntime, type DowntimeAction } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';

const TYPE_ICONS: Record<string, string> = { Crafting: '🔨', Training: '⚔️', Research: '📚', Carousing: '🍺', Working: '💼', Exploring: '🗺️', Other: '❓' };

export default function AdminDowntimePage() {
  const { isAdmin } = useAuth();
  const [actions, setActions] = useState<DowntimeAction[]>([]);
  const [filter, setFilter] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [resolveForm, setResolveForm] = useState<{ id: string; status: string; dmNotes: string; reward: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    getAdminDowntime(filter).then(setActions).finally(() => setLoading(false));
  }, [isAdmin, filter]);

  const handleResolve = async () => {
    if (!resolveForm) return;
    await resolveDowntime(resolveForm.id, { status: resolveForm.status, dmNotes: resolveForm.dmNotes, reward: resolveForm.reward });
    setResolveForm(null);
    getAdminDowntime(filter).then(setActions);
  };

  if (!isAdmin) return <ParchmentPanel title="Access Denied"><p>Admin only.</p></ParchmentPanel>;
  if (loading) return <CandleLoader text="Loading..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">🏕️ Downtime Review</h1>
        <div className="flex gap-1">
          {['Pending','Approved','Resolved','Rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded text-xs ${filter === s ? 'bg-[var(--gold)] text-[var(--wood-dark)]' : 'bg-[var(--wood-dark)] text-[var(--parchment-dark)]'}`}>{s}</button>
          ))}
        </div>
      </div>

      {actions.length === 0 ? (
        <ParchmentPanel><p className="text-[var(--ink-faded)] text-center">No {filter.toLowerCase()} downtime actions.</p></ParchmentPanel>
      ) : actions.map(a => (
        <ParchmentPanel key={a.action_id}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-lg mr-1">{TYPE_ICONS[a.type]}</span>
              <span className="font-bold">{a.player_name}</span>
              <span className="text-sm text-[var(--parchment-dark)]"> as {a.character_name} — {a.type}</span>
            </div>
            {filter === 'Pending' && (
              <div className="flex gap-1">
                <WoodButton variant="sm" onClick={() => setResolveForm({ id: a.action_id, status: 'Approved', dmNotes: '', reward: '' })}>Approve</WoodButton>
                <WoodButton variant="sm" onClick={() => setResolveForm({ id: a.action_id, status: 'Rejected', dmNotes: '', reward: '' })}>Reject</WoodButton>
              </div>
            )}
          </div>
          <p className="text-sm mt-2">{a.description}</p>
          {a.goal && <p className="text-xs text-[var(--ink-faded)] mt-1">Goal: {a.goal}</p>}

          {resolveForm?.id === a.action_id && (
            <div className="mt-3 p-3 bg-[var(--wood-dark)] rounded space-y-2">
              <div>
                <label className="block text-xs font-bold mb-1">DM Notes</label>
                <textarea className="parchment-input w-full h-16" value={resolveForm.dmNotes} onChange={e => setResolveForm({ ...resolveForm, dmNotes: e.target.value })} placeholder="Your ruling..." />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Reward (items, info, gold, etc.)</label>
                <input className="parchment-input w-full" value={resolveForm.reward} onChange={e => setResolveForm({ ...resolveForm, reward: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <WoodButton onClick={handleResolve}>Confirm {resolveForm.status}</WoodButton>
                <WoodButton variant="secondary" onClick={() => setResolveForm(null)}>Cancel</WoodButton>
              </div>
            </div>
          )}
        </ParchmentPanel>
      ))}
    </div>
  );
}

