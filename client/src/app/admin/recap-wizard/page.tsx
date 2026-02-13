'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getAdminSessionDetail, getSessionPrep, exportSessionNotes, type SessionPrep, type SessionDetail } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';

const STEPS = ['Recap', 'Attendance', 'Loot', 'Leveling', 'NPCs & World', 'Export'];

export default function RecapWizardPage() { return <Suspense><RecapWizardInner /></Suspense>; }

function RecapWizardInner() {
  usePageTitle('Recap Wizard');
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') || '';
  const { isAdmin } = useAuth();
  const [step, setStep] = useState(0);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [, setPrep] = useState<SessionPrep | null>(null);
  const [recap, setRecap] = useState('');
  const [lootItems, setLootItems] = useState<{name: string; rarity: string; characterId: string}[]>([]);
  const [npcs, setNpcs] = useState('');
  const [worldFacts, setWorldFacts] = useState<{fact: string; value: string}[]>([]);
  const [exported, setExported] = useState(false);
  const [exportMd, setExportMd] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    getAdminSessionDetail(sessionId).then(setSession);
    getSessionPrep(sessionId).then(p => {
      setPrep(p);
      if (p?.previously_on) setRecap(p.previously_on);
      if (p?.key_npcs) setNpcs(p.key_npcs);
    });
  }, [sessionId]);

  const handleExport = async () => {
    const result = await exportSessionNotes(sessionId);
    setExportMd(result.markdown);
    setExported(true);
  };

  const downloadMd = () => {
    const blob = new Blob([exportMd], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session?.campaign}-${session?.date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) return <ParchmentPanel title="Access Denied"><p>Admin only.</p></ParchmentPanel>;
  if (!session) return <CandleLoader text="Loading session..." />;

  return (
    <div className="space-y-6">
      <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">📜 Post-Session Recap Wizard</h1>
      <p className="text-sm text-[var(--parchment-dark)]">{session.campaign} — {session.title || 'Untitled'} — {session.date}</p>

      {/* Progress */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => setStep(i)}
            className={`flex-1 py-2 text-xs text-center rounded transition-colors ${i === step ? 'bg-[var(--gold)] text-[var(--wood-dark)] font-bold' : i < step ? 'bg-green-900/30 text-green-400' : 'bg-[var(--wood-dark)] text-[var(--ink-faded)]'}`}>
            {i < step ? '✓ ' : ''}{s}
          </button>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <ParchmentPanel title="What Happened?">
          <p className="text-xs text-[var(--ink-faded)] mb-2">Write or paste your session recap. Markdown supported. Pre-populated from your prep notes if available.</p>
          <textarea className="parchment-input w-full h-48 font-mono text-sm" value={recap} onChange={e => setRecap(e.target.value)} placeholder="The party ventured into the Sunken Temple..." />
        </ParchmentPanel>
      )}

      {step === 1 && (
        <ParchmentPanel title="Who Was There?">
          <p className="text-xs text-[var(--ink-faded)] mb-2">Auto-filled from registrations. Adjust if needed.</p>
          {session.registrations?.map(r => (
            <div key={r.registrationId} className="flex items-center justify-between p-2 bg-[var(--wood-dark)] rounded mb-1">
              <div>
                <span className="font-bold">{r.playerName}</span>
                <span className="text-sm text-[var(--parchment-dark)] ml-2">as {r.characterName} (Lvl {r.characterLevel})</span>
              </div>
              <span className={r.attendanceConfirmed ? 'text-green-400' : 'text-[var(--ink-faded)]'}>{r.attendanceConfirmed ? '✓ Present' : '? Unknown'}</span>
            </div>
          )) || <p className="text-[var(--ink-faded)]">No registrations found.</p>}
        </ParchmentPanel>
      )}

      {step === 2 && (
        <ParchmentPanel title="Loot Awarded">
          <p className="text-xs text-[var(--ink-faded)] mb-2">Add items the party found. These go into character inventories.</p>
          {lootItems.map((item, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 mb-2">
              <input className="parchment-input" placeholder="Item name" value={item.name} onChange={e => { const l = [...lootItems]; l[i].name = e.target.value; setLootItems(l); }} />
              <select className="parchment-input" value={item.rarity} onChange={e => { const l = [...lootItems]; l[i].rarity = e.target.value; setLootItems(l); }}>
                {['Common','Uncommon','Rare','Very Rare','Legendary'].map(r => <option key={r}>{r}</option>)}
              </select>
              <button onClick={() => setLootItems(lootItems.filter((_, j) => j !== i))} className="text-red-400 text-xs">Remove</button>
            </div>
          ))}
          <WoodButton onClick={() => setLootItems([...lootItems, { name: '', rarity: 'Common', characterId: '' }])} variant="secondary">+ Add Item</WoodButton>
        </ParchmentPanel>
      )}

      {step === 3 && (
        <ParchmentPanel title="XP / Milestones">
          <p className="text-xs text-[var(--ink-faded)] mb-2">Level up characters as needed. Click to bump their level.</p>
          {session.registrations?.map(r => (
            <div key={r.registrationId} className="flex items-center justify-between p-2 bg-[var(--wood-dark)] rounded mb-1">
              <span>{r.characterName} — Level {r.characterLevel}</span>
              <WoodButton variant="sm" href={`/admin/players`}>Level Up →</WoodButton>
            </div>
          ))}
        </ParchmentPanel>
      )}

      {step === 4 && (
        <ParchmentPanel title="Key NPCs & World State">
          <div className="mb-4">
            <label className="block text-xs font-bold mb-1">Key NPCs Encountered</label>
            <textarea className="parchment-input w-full h-20" value={npcs} onChange={e => setNpcs(e.target.value)} placeholder="One per line: Gundren Rockseeker, Sildar Hallwinter..." />
          </div>
          <div>
            <label className="block text-xs font-bold mb-2">World State Changes</label>
            {worldFacts.map((wf, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 mb-2">
                <input className="parchment-input" placeholder="Fact (e.g. 'King's Status')" value={wf.fact} onChange={e => { const w = [...worldFacts]; w[i].fact = e.target.value; setWorldFacts(w); }} />
                <input className="parchment-input" placeholder="Value (e.g. 'Dead')" value={wf.value} onChange={e => { const w = [...worldFacts]; w[i].value = e.target.value; setWorldFacts(w); }} />
              </div>
            ))}
            <WoodButton onClick={() => setWorldFacts([...worldFacts, { fact: '', value: '' }])} variant="secondary">+ Add Fact</WoodButton>
          </div>
        </ParchmentPanel>
      )}

      {step === 5 && (
        <ParchmentPanel title="Export to Obsidian">
          {!exported ? (
            <div className="text-center py-8">
              <p className="text-[var(--parchment-dark)] mb-4">Generate a markdown file with YAML frontmatter ready for your Obsidian vault.</p>
              <WoodButton onClick={handleExport}>Generate Obsidian Export</WoodButton>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-green-400">✓ Export generated</span>
                <WoodButton onClick={downloadMd} variant="sm">Download .md</WoodButton>
              </div>
              <pre className="parchment-input w-full h-64 overflow-auto text-xs font-mono whitespace-pre-wrap">{exportMd}</pre>
            </div>
          )}
        </ParchmentPanel>
      )}

      {/* Nav buttons */}
      <div className="flex justify-between">
        <WoodButton onClick={() => setStep(Math.max(0, step - 1))} variant="secondary" disabled={step === 0}>← Previous</WoodButton>
        {step < STEPS.length - 1 ? (
          <WoodButton onClick={() => setStep(step + 1)}>Next →</WoodButton>
        ) : (
          <WoodButton onClick={() => window.location.href = '/admin/sessions'}>Finish</WoodButton>
        )}
      </div>
    </div>
  );
}

