'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getMyDowntime, submitDowntime, getMyCharactersV2, getCampaignsList, type DowntimeAction, type CharacterSheet, type Campaign } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';

const TYPES = ['Crafting','Training','Research','Carousing','Working','Exploring','Other'];
const TYPE_ICONS: Record<string, string> = { Crafting: '🔨', Training: '⚔️', Research: '📚', Carousing: '🍺', Working: '💼', Exploring: '🗺️', Other: '❓' };

export default function DowntimePage() {
  usePageTitle('Downtime Actions');
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [actions, setActions] = useState<DowntimeAction[]>([]);
  const [chars, setChars] = useState<CharacterSheet[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ characterId: '', campaignId: '', type: 'Other', description: '', goal: '', duration: '' });

  useEffect(() => {
    if (!isLoggedIn) return;
    Promise.all([getMyDowntime(), getMyCharactersV2(), getCampaignsList()]).then(([a, c, ca]) => {
      setActions(a); setChars(c); setCampaigns(ca);
    }).finally(() => setLoading(false));
  }, [isLoggedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitDowntime(form);
    setShowForm(false);
    setForm({ characterId: '', campaignId: '', type: 'Other', description: '', goal: '', duration: '' });
    getMyDowntime().then(setActions);
  };

  if (authLoading) return <CandleLoader text="Checking credentials..." />;
  if (!isLoggedIn) return <ParchmentPanel title="Sign In Required"><p>Please sign in.</p></ParchmentPanel>;
  if (loading) return <CandleLoader text="Loading downtime..." />;

  const statusColors: Record<string, string> = { Pending: 'text-yellow-400', Approved: 'text-blue-400', Rejected: 'text-red-400', Resolved: 'text-green-400' };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">🏕️ Downtime Actions</h1>
        <WoodButton onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Action'}</WoodButton>
      </div>

      {showForm && (
        <ParchmentPanel title="Submit Downtime Action">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">Character *</label>
              <select required className="parchment-input w-full" value={form.characterId} onChange={e => setForm({ ...form, characterId: e.target.value })}>
                <option value="">Select...</option>
                {chars.map(c => <option key={c.character_id} value={c.character_id}>{c.name} (Lvl {c.level})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Type *</label>
              <select className="parchment-input w-full" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-full">
              <label className="block text-xs font-bold mb-1">What are you doing? *</label>
              <textarea required className="parchment-input w-full h-20" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="I spend my downtime..." />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Goal</label>
              <input className="parchment-input w-full" value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} placeholder="What I hope to achieve..." />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Duration</label>
              <input className="parchment-input w-full" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="3 days, 1 week, etc." />
            </div>
            <div className="col-span-full flex justify-end">
              <WoodButton type="submit">Submit for DM Review</WoodButton>
            </div>
          </form>
        </ParchmentPanel>
      )}

      {actions.length === 0 && !showForm ? (
        <ParchmentPanel><p className="text-[var(--ink-faded)] text-center">No downtime actions yet. What will your character do between adventures?</p></ParchmentPanel>
      ) : (
        <div className="space-y-3">
          {actions.map(a => (
            <ParchmentPanel key={a.action_id}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-lg mr-2">{TYPE_ICONS[a.type] || '❓'}</span>
                  <span className="font-bold">{a.character_name}</span>
                  <span className="text-sm text-[var(--parchment-dark)] ml-2">— {a.type}</span>
                </div>
                <span className={`text-xs font-bold ${statusColors[a.status] || ''}`}>{a.status}</span>
              </div>
              <p className="text-sm mt-2">{a.description}</p>
              {a.goal && <p className="text-xs text-[var(--ink-faded)] mt-1">Goal: {a.goal}</p>}
              {a.dm_notes && <div className="mt-2 p-2 bg-[var(--gold)]/10 rounded text-sm"><strong>DM:</strong> {a.dm_notes}</div>}
              {a.reward && <div className="mt-1 text-sm text-[var(--gold)]">Reward: {a.reward}</div>}
            </ParchmentPanel>
          ))}
        </div>
      )}
    </div>
  );
}

