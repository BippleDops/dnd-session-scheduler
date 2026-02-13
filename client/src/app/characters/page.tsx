'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getMyCharactersV2, createMyCharacter, updateMyCharacter, retireMyCharacter, type CharacterSheet } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';
import { useToast } from '@/components/ui/Toast';
import { EmptyStateFromPreset } from '@/components/ui/EmptyState';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import Link from 'next/link';

const CLASSES = ['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard','Artificer','Blood Hunter'];
const CLASS_ICONS: Record<string, string> = { Barbarian: '🪓', Bard: '🎵', Cleric: '✝️', Druid: '🌿', Fighter: '⚔️', Monk: '👊', Paladin: '🛡️', Ranger: '🏹', Rogue: '🗡️', Sorcerer: '✨', Warlock: '👁️', Wizard: '🧙', Artificer: '⚙️', 'Blood Hunter': '🩸' };
const RACES = ['Human','Elf','Dwarf','Halfling','Gnome','Half-Elf','Half-Orc','Tiefling','Dragonborn','Goliath','Aasimar','Genasi','Tabaxi','Firbolg','Kenku','Lizardfolk','Changeling','Shifter','Warforged'];

export default function CharactersPage() {
  usePageTitle('Characters');
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [chars, setChars] = useState<CharacterSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const confirm = useConfirm();
  const { toast } = useToast();

  const load = useCallback(() => {
    if (!isLoggedIn) return;
    getMyCharactersV2().then(setChars).finally(() => setLoading(false));
  }, [isLoggedIn]);

  useEffect(load, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await updateMyCharacter(editId, form);
        toast('Character updated!', 'success');
      } else {
        await createMyCharacter(form);
        toast('Character created!', 'success');
      }
      setShowForm(false);
      setEditId(null);
      setForm({});
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save character', 'error');
    }
  };

  const startEdit = (c: CharacterSheet) => {
    setEditId(c.character_id);
    setForm({
      name: c.name, class: c.class, subclass: c.subclass || '', level: String(c.level),
      race: c.race, backstory: c.backstory || '', portraitUrl: c.portrait_url || '',
      hp: String(c.hp || ''), maxHp: String(c.max_hp || ''), ac: String(c.ac || 10),
      str: String(c.str), dex: String(c.dex), con: String(c.con),
      int: String(c.int_), wis: String(c.wis), cha: String(c.cha),
      proficiencies: c.proficiencies || '', equipment: c.equipment || '',
    });
    setShowForm(true);
  };

  const handleRetire = async (id: string) => {
    const ok = await confirm({ title: 'Retire Character?', message: 'This character will be permanently retired. Their adventures end here. This cannot be undone.', confirmLabel: 'Retire', variant: 'danger' });
    if (!ok) return;
    try {
      await retireMyCharacter(id);
      toast('Character retired', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to retire character', 'error');
    }
  };

  if (authLoading) return <CandleLoader text="Checking credentials..." />;
  if (!isLoggedIn) return <ParchmentPanel title="Sign In Required"><p>Please sign in to manage characters.</p></ParchmentPanel>;
  if (loading) return <CandleLoader text="Loading characters..." />;

  const statMod = (val: number) => { const m = Math.floor((val - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">📜 Character Roster</h1>
        <WoodButton onClick={() => { setShowForm(!showForm); setEditId(null); setForm({}); }}>
          {showForm ? 'Cancel' : '+ New Character'}
        </WoodButton>
      </div>

      {showForm && (
        <ParchmentPanel title={editId ? '✏️ Edit Character' : '✨ Create New Character'}>
          <p className="text-sm text-[var(--ink-faded)] mb-4">
            {editId ? 'Update your character details below.' : 'Fill in your character details to begin your adventure. Only Name is required — you can fill in the rest later.'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identity */}
            <div>
              <h3 className="font-[var(--font-heading)] text-base text-[var(--gold)] mb-3 flex items-center gap-2">
                👤 Identity
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Character Name *</label>
                  <input required className="tavern-input" placeholder="e.g., Thorn Ironforge" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Race / Ancestry</label>
                  <select className="tavern-input" value={form.race || ''} onChange={e => setForm({ ...form, race: e.target.value })}>
                    <option value="">— Select Race —</option>
                    {RACES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Class</label>
                  <select className="tavern-input" value={form.class || ''} onChange={e => setForm({ ...form, class: e.target.value })}>
                    <option value="">— Select Class —</option>
                    {CLASSES.map(c => <option key={c} value={c}>{CLASS_ICONS[c] || '⚔️'} {c}</option>)}
                  </select>
                  {form.class && <span className="text-lg mt-1 inline-block">{CLASS_ICONS[form.class] || '⚔️'}</span>}
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Subclass</label>
                  <input className="tavern-input" placeholder="e.g., Champion, Evocation" value={form.subclass || ''} onChange={e => setForm({ ...form, subclass: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Level</label>
                  <input type="number" min="1" max="20" className="tavern-input" value={form.level || '1'} onChange={e => setForm({ ...form, level: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Portrait URL</label>
                  <input className="tavern-input" value={form.portraitUrl || ''} onChange={e => setForm({ ...form, portraitUrl: e.target.value })} placeholder="https://your-image-url.png" />
                  {form.portraitUrl && (
                    <img src={form.portraitUrl} alt="Preview" className="w-16 h-16 mt-2 rounded-lg object-cover border border-[var(--parchment-dark)]"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                </div>
              </div>
            </div>

            {/* Combat Stats */}
            <div>
              <h3 className="font-[var(--font-heading)] text-base text-[var(--gold)] mb-3 flex items-center gap-2">
                ⚔️ Combat Stats
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">❤️ HP</label>
                  <input type="number" className="tavern-input" placeholder="0" value={form.hp || ''} onChange={e => setForm({ ...form, hp: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">❤️ Max HP</label>
                  <input type="number" className="tavern-input" placeholder="0" value={form.maxHp || ''} onChange={e => setForm({ ...form, maxHp: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">🛡️ AC</label>
                  <input type="number" className="tavern-input" value={form.ac || '10'} onChange={e => setForm({ ...form, ac: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Ability Scores */}
            <div>
              <h3 className="font-[var(--font-heading)] text-base text-[var(--gold)] mb-3 flex items-center gap-2">
                🎲 Ability Scores
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { key: 'str', label: 'STR', icon: '💪' },
                  { key: 'dex', label: 'DEX', icon: '🏃' },
                  { key: 'con', label: 'CON', icon: '🫀' },
                  { key: 'int', label: 'INT', icon: '🧠' },
                  { key: 'wis', label: 'WIS', icon: '👁️' },
                  { key: 'cha', label: 'CHA', icon: '✨' },
                ].map(s => (
                  <div key={s.key} className="text-center">
                    <label className="block text-xs font-bold mb-1">{s.icon} {s.label}</label>
                    <input type="number" min="1" max="30" className="tavern-input text-center text-lg font-bold" value={form[s.key] || '10'} onChange={e => setForm({ ...form, [s.key]: e.target.value })} />
                    <span className="block text-[10px] text-[var(--gold)] mt-0.5">
                      {(() => { const v = parseInt(form[s.key] || '10', 10); const m = Math.floor((v - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; })()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Background */}
            <div>
              <h3 className="font-[var(--font-heading)] text-base text-[var(--gold)] mb-3 flex items-center gap-2">
                📖 Background
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Backstory</label>
                  <textarea className="tavern-input h-24" placeholder="Where did your character come from? What drives them?" value={form.backstory || ''} onChange={e => setForm({ ...form, backstory: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Proficiencies</label>
                    <textarea className="tavern-input h-16" placeholder="Skills, tools, languages..." value={form.proficiencies || ''} onChange={e => setForm({ ...form, proficiencies: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Equipment</label>
                    <textarea className="tavern-input h-16" placeholder="Weapons, armor, gear..." value={form.equipment || ''} onChange={e => setForm({ ...form, equipment: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--parchment-dark)]">
              <WoodButton type="button" variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</WoodButton>
              <WoodButton variant="primary" type="submit">{editId ? '💾 Save Changes' : '✨ Create Character'}</WoodButton>
            </div>
          </form>
        </ParchmentPanel>
      )}

      {chars.length === 0 && !showForm && (
        <EmptyStateFromPreset preset="characters" action={{ label: '+ Create Character', href: '#' }} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chars.map(c => (
          <ParchmentPanel key={c.character_id} className="hover:shadow-lg transition-shadow">
            <div className="flex gap-3">
              {c.portrait_url ? (
                <img src={c.portrait_url} alt={c.name} className="w-16 h-16 rounded-lg object-cover border-2 border-[var(--wood-dark)]" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-[var(--wood-dark)] flex items-center justify-center text-2xl">{CLASS_ICONS[c.class?.split(',')[0]?.trim()] || '⚔️'}</div>
              )}
              <div className="flex-1 min-w-0">
                <Link href={`/character?id=${c.character_id}`} className="font-[var(--font-heading)] text-lg text-[var(--gold)] hover:underline block truncate">{c.name}</Link>
                <p className="text-sm text-[var(--ink-faded)]">{c.race} {c.class}{c.subclass ? ` (${c.subclass})` : ''}</p>
                <p className="text-xs text-[var(--gold)]">Level {c.level}</p>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1 mt-3">
              {[['STR', c.str], ['DEX', c.dex], ['CON', c.con], ['INT', c.int_], ['WIS', c.wis], ['CHA', c.cha]].map(([label, val]) => (
                <div key={label as string} className="text-center">
                  <span className="block text-[10px] text-[var(--ink-faded)] uppercase">{label as string}</span>
                  <span className="block text-sm font-bold">{val as number}</span>
                  <span className="block text-[10px] text-[var(--gold)]">{statMod(val as number)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-3 pt-2 border-t border-[var(--wood-dark)]">
              <div className="flex gap-1 text-xs">
                <span title="HP">❤️ {c.hp}/{c.max_hp}</span>
                <span title="AC">🛡️ {c.ac}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(c)} className="text-xs px-2 py-1 bg-[var(--wood)] rounded hover:bg-[var(--wood-light)] transition-colors">Edit</button>
                <button onClick={() => handleRetire(c.character_id)} className="text-xs px-2 py-1 bg-red-900/30 rounded hover:bg-red-900/50 transition-colors text-red-300">Retire</button>
              </div>
            </div>
          </ParchmentPanel>
        ))}
      </div>
    </div>
  );
}

