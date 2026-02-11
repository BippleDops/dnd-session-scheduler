'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getSessionPrep, saveSessionPrep, getSessionChecklist, saveSessionChecklist, getAdminSessionDetail, type SessionPrep, type SessionChecklist, type SessionDetail } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';

export default function PrepPage() { return <Suspense><PrepInner /></Suspense>; }

function PrepInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') || '';
  const { isAdmin } = useAuth();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [prep, setPrep] = useState<SessionPrep | null>(null);
  const [checklist, setChecklist] = useState<SessionChecklist | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getAdminSessionDetail(sessionId).then(setSession);
    getSessionPrep(sessionId).then(setPrep);
    getSessionChecklist(sessionId).then(setChecklist);
  }, [sessionId]);

  const handleSavePrep = async () => {
    if (!prep) return;
    setSaving(true);
    await saveSessionPrep(sessionId, {
      previouslyOn: prep.previously_on, keyNpcs: prep.key_npcs,
      scenesPlanned: prep.scenes_planned, secrets: prep.secrets,
      possibleLoot: prep.possible_loot, dmTeaser: prep.dm_teaser,
      foundryScene: prep.foundry_scene, mapScreenshotUrl: prep.map_screenshot_url,
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleChecklist = async (field: string) => {
    if (!checklist) return;
    const updated = { ...checklist, [field]: checklist[field as keyof SessionChecklist] ? 0 : 1 };
    setChecklist(updated);
    await saveSessionChecklist(sessionId, updated);
  };

  if (!isAdmin) return <ParchmentPanel title="Access Denied"><p>Admin only.</p></ParchmentPanel>;
  if (!session || !prep) return <CandleLoader text="Loading prep..." />;

  const checklistItems = [
    { key: 'recap_written', label: 'Previous session recap written', icon: '📝' },
    { key: 'attendance_confirmed', label: 'All players confirmed attendance', icon: '✅' },
    { key: 'characters_leveled', label: 'Characters leveled up correctly', icon: '⬆️' },
    { key: 'foundry_loaded', label: 'Foundry scenes loaded', icon: '🎮' },
    { key: 'prep_reviewed', label: 'Prep notes reviewed', icon: '📋' },
    { key: 'loot_prepared', label: 'Loot table prepared', icon: '💰' },
    { key: 'music_set', label: 'Music/ambiance set', icon: '🎵' },
  ];

  const completedCount = checklist ? checklistItems.filter(i => checklist[i.key as keyof SessionChecklist]).length : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">🗺️ DM Prep — {session.title || session.campaign}</h1>
          <p className="text-sm text-[var(--parchment-dark)]">{session.date} at {session.startTime}</p>
        </div>
        <WoodButton onClick={handleSavePrep} disabled={saving}>{saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Prep Notes'}</WoodButton>
      </div>

      {/* Pre-flight Checklist */}
      <ParchmentPanel title={`Pre-Flight Checklist (${completedCount}/${checklistItems.length})`}>
        <div className="h-2 bg-[var(--wood-dark)] rounded overflow-hidden mb-3">
          <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${(completedCount / checklistItems.length) * 100}%` }} />
        </div>
        <div className="space-y-1">
          {checklistItems.map(item => (
            <button key={item.key} onClick={() => toggleChecklist(item.key)}
              className={`w-full text-left flex items-center gap-2 p-2 rounded transition-colors ${checklist?.[item.key as keyof SessionChecklist] ? 'bg-green-900/20 text-green-400' : 'bg-[var(--wood-dark)] text-[var(--parchment-dark)]'}`}>
              <span>{checklist?.[item.key as keyof SessionChecklist] ? '✅' : '⬜'}</span>
              <span>{item.icon} {item.label}</span>
            </button>
          ))}
        </div>
      </ParchmentPanel>

      {/* Prep notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ParchmentPanel title="Previously On...">
          <textarea className="parchment-input w-full h-32" value={prep.previously_on || ''} onChange={e => setPrep({ ...prep, previously_on: e.target.value })} placeholder="Last session, the party..." />
        </ParchmentPanel>

        <ParchmentPanel title="DM Teaser (sent to players)">
          <textarea className="parchment-input w-full h-32" value={prep.dm_teaser || ''} onChange={e => setPrep({ ...prep, dm_teaser: e.target.value })} placeholder="A mysterious fog rolls into town..." />
        </ParchmentPanel>

        <ParchmentPanel title="Key NPCs This Session">
          <textarea className="parchment-input w-full h-24" value={prep.key_npcs || ''} onChange={e => setPrep({ ...prep, key_npcs: e.target.value })} placeholder="One per line..." />
        </ParchmentPanel>

        <ParchmentPanel title="Scenes Planned">
          <textarea className="parchment-input w-full h-24" value={prep.scenes_planned || ''} onChange={e => setPrep({ ...prep, scenes_planned: e.target.value })} placeholder="1. Tavern encounter\n2. Travel to the ruins\n3. Boss fight" />
        </ParchmentPanel>

        <ParchmentPanel title="Secrets & Clues">
          <textarea className="parchment-input w-full h-24" value={prep.secrets || ''} onChange={e => setPrep({ ...prep, secrets: e.target.value })} placeholder="The barkeep is actually a dragon in disguise..." />
        </ParchmentPanel>

        <ParchmentPanel title="Possible Loot">
          <textarea className="parchment-input w-full h-24" value={prep.possible_loot || ''} onChange={e => setPrep({ ...prep, possible_loot: e.target.value })} placeholder="Sword of Dragonslaying, 500gp, Scroll of Fireball" />
        </ParchmentPanel>

        <ParchmentPanel title="Foundry Scene">
          <input className="parchment-input w-full" value={prep.foundry_scene || ''} onChange={e => setPrep({ ...prep, foundry_scene: e.target.value })} placeholder="Scene name in Foundry VTT" />
        </ParchmentPanel>

        <ParchmentPanel title="Map Screenshot URL">
          <input className="parchment-input w-full" value={prep.map_screenshot_url || ''} onChange={e => setPrep({ ...prep, map_screenshot_url: e.target.value })} placeholder="https://..." />
          {prep.map_screenshot_url && <img src={prep.map_screenshot_url} alt="Map" className="mt-2 rounded max-h-40 object-cover" />}
        </ParchmentPanel>
      </div>
    </div>
  );
}

