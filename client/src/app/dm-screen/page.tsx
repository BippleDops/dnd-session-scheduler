'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import { DiceRoller } from '@/components/ui/DiceRoller';

const CONDITIONS = [
  { name: 'Blinded', effect: "Can't see. Auto-fail sight checks. Attacks have disadvantage, attacks against have advantage." },
  { name: 'Charmed', effect: "Can't attack the charmer. Charmer has advantage on social checks." },
  { name: 'Deafened', effect: "Can't hear. Auto-fail hearing checks." },
  { name: 'Frightened', effect: "Disadvantage on checks/attacks while source is in sight. Can't willingly move closer." },
  { name: 'Grappled', effect: "Speed becomes 0. Ends if grappler is incapacitated or forced apart." },
  { name: 'Incapacitated', effect: "Can't take actions or reactions." },
  { name: 'Invisible', effect: "Impossible to see without magic. Attacks have advantage, attacks against have disadvantage." },
  { name: 'Paralyzed', effect: "Incapacitated, can't move or speak. Auto-fail STR/DEX saves. Attacks have advantage. Melee hits are crits." },
  { name: 'Petrified', effect: "Transformed to stone. Weight ×10. Incapacitated, can't move/speak. Resistance to all damage." },
  { name: 'Poisoned', effect: "Disadvantage on attack rolls and ability checks." },
  { name: 'Prone', effect: "Disadvantage on attacks. Melee attacks against have advantage, ranged have disadvantage. Must spend half movement to stand." },
  { name: 'Restrained', effect: "Speed 0. Attacks have disadvantage. Attacks against have advantage. Disadvantage on DEX saves." },
  { name: 'Stunned', effect: "Incapacitated, can't move, can speak only falteringly. Auto-fail STR/DEX saves. Attacks against have advantage." },
  { name: 'Unconscious', effect: "Incapacitated, can't move/speak, unaware. Drop what held, fall prone. Auto-fail STR/DEX saves. Attacks have advantage. Melee hits are crits." },
];

const ACTIONS_IN_COMBAT = [
  { name: 'Attack', desc: 'Melee or ranged attack with a weapon.' },
  { name: 'Cast a Spell', desc: 'Cast a spell with a casting time of 1 action.' },
  { name: 'Dash', desc: 'Gain extra movement equal to your speed.' },
  { name: 'Disengage', desc: 'Your movement doesn\'t provoke opportunity attacks.' },
  { name: 'Dodge', desc: 'Attacks against you have disadvantage. Advantage on DEX saves.' },
  { name: 'Help', desc: 'Give an ally advantage on their next check or attack.' },
  { name: 'Hide', desc: 'Make a DEX (Stealth) check to hide.' },
  { name: 'Ready', desc: 'Prepare an action to trigger on a specific condition.' },
  { name: 'Search', desc: 'Make a WIS (Perception) or INT (Investigation) check.' },
  { name: 'Use an Object', desc: 'Interact with an object that requires your action.' },
];

const SKILL_DCS = [
  { dc: 5, difficulty: 'Very Easy' },
  { dc: 10, difficulty: 'Easy' },
  { dc: 15, difficulty: 'Medium' },
  { dc: 20, difficulty: 'Hard' },
  { dc: 25, difficulty: 'Very Hard' },
  { dc: 30, difficulty: 'Nearly Impossible' },
];

const COVER = [
  { type: 'Half Cover', ac: '+2 AC, +2 DEX saves', example: 'Low wall, furniture, creatures' },
  { type: 'Three-Quarters', ac: '+5 AC, +5 DEX saves', example: 'Arrow slit, thick tree' },
  { type: 'Total Cover', ac: "Can't be targeted directly", example: 'Completely concealed' },
];

export default function DMScreenPage() {
  usePageTitle('DM Screen');
  const { isAdmin } = useAuth();
  const [searchCond, setSearchCond] = useState('');
  const [activePanel, setActivePanel] = useState<string>('conditions');

  if (!isAdmin) return <ParchmentPanel title="Access Denied"><p>Admin only.</p></ParchmentPanel>;

  const panels = [
    { id: 'conditions', label: '⚡ Conditions', icon: '⚡' },
    { id: 'actions', label: '⚔️ Actions', icon: '⚔️' },
    { id: 'dcs', label: '🎯 DCs', icon: '🎯' },
    { id: 'cover', label: '🛡️ Cover', icon: '🛡️' },
  ];

  const filteredConditions = CONDITIONS.filter(c => !searchCond || c.name.toLowerCase().includes(searchCond.toLowerCase()));

  return (
    <div className="space-y-4">
      <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">🏰 DM Screen</h1>

      {/* Panel selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {panels.map(p => (
          <button key={p.id} onClick={() => setActivePanel(p.id)}
            className={`px-4 py-2 rounded text-sm font-[var(--font-heading)] whitespace-nowrap transition-colors ${
              activePanel === p.id ? 'bg-[var(--gold)] text-[var(--wood-dark)]' : 'bg-[var(--wood-dark)] text-[var(--parchment-dark)] hover:bg-[var(--wood-light)]'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {activePanel === 'conditions' && (
        <ParchmentPanel title="⚡ Conditions Reference">
          <input className="tavern-input mb-3" placeholder="Search conditions..." value={searchCond} onChange={e => setSearchCond(e.target.value)} />
          <div className="space-y-2">
            {filteredConditions.map(c => (
              <div key={c.name} className="p-3 rounded bg-[rgba(0,0,0,0.03)]">
                <span className="font-semibold text-[var(--ink)]">{c.name}</span>
                <p className="text-xs text-[var(--ink-faded)] mt-1">{c.effect}</p>
              </div>
            ))}
          </div>
        </ParchmentPanel>
      )}

      {activePanel === 'actions' && (
        <ParchmentPanel title="⚔️ Actions in Combat">
          <div className="space-y-2">
            {ACTIONS_IN_COMBAT.map(a => (
              <div key={a.name} className="p-3 rounded bg-[rgba(0,0,0,0.03)]">
                <span className="font-semibold text-[var(--ink)]">{a.name}</span>
                <p className="text-xs text-[var(--ink-faded)] mt-1">{a.desc}</p>
              </div>
            ))}
          </div>
        </ParchmentPanel>
      )}

      {activePanel === 'dcs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ParchmentPanel title="🎯 Skill Check DCs">
            <div className="space-y-1">
              {SKILL_DCS.map(d => (
                <div key={d.dc} className="flex justify-between p-2 rounded bg-[rgba(0,0,0,0.03)]">
                  <span className="text-sm text-[var(--ink)]">{d.difficulty}</span>
                  <span className="font-bold text-[var(--gold)]">DC {d.dc}</span>
                </div>
              ))}
            </div>
          </ParchmentPanel>
          <ParchmentPanel title="🛡️ Cover Rules">
            <div className="space-y-2">
              {COVER.map(c => (
                <div key={c.type} className="p-3 rounded bg-[rgba(0,0,0,0.03)]">
                  <div className="flex justify-between">
                    <span className="font-semibold text-[var(--ink)]">{c.type}</span>
                    <span className="text-xs text-[var(--gold)]">{c.ac}</span>
                  </div>
                  <p className="text-[10px] text-[var(--ink-faded)] mt-1">Example: {c.example}</p>
                </div>
              ))}
            </div>
          </ParchmentPanel>
        </div>
      )}

      {activePanel === 'cover' && (
        <ParchmentPanel title="📏 Quick References">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-[var(--ink)] mb-2">Travel Pace</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>Fast (30 mi/day)</span><span className="text-[var(--gold)]">-5 passive Perception</span></div>
                <div className="flex justify-between"><span>Normal (24 mi/day)</span><span className="text-[var(--gold)]">No modifier</span></div>
                <div className="flex justify-between"><span>Slow (18 mi/day)</span><span className="text-[var(--gold)]">Can stealth</span></div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-[var(--ink)] mb-2">Light</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>Bright Light</span><span>Normal vision</span></div>
                <div className="flex justify-between"><span>Dim Light</span><span className="text-yellow-600">Lightly obscured, disadv. Perception</span></div>
                <div className="flex justify-between"><span>Darkness</span><span className="text-red-400">Heavily obscured, effectively blinded</span></div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-[var(--ink)] mb-2">Exhaustion Levels</h4>
              <div className="space-y-1 text-xs">
                {['Disadvantage on ability checks','Speed halved','Disadvantage on attacks/saves','HP maximum halved','Speed reduced to 0','Death'].map((e, i) => (
                  <div key={i} className="flex justify-between"><span className="text-[var(--ink-faded)]">Level {i+1}</span><span>{e}</span></div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-[var(--ink)] mb-2">Common Object ACs</h4>
              <div className="space-y-1 text-xs">
                {[['Cloth/Paper', 11], ['Rope/Hide', 11], ['Wood', 15], ['Stone', 17], ['Iron/Steel', 19], ['Mithral', 21], ['Adamantine', 23]].map(([m,ac]) => (
                  <div key={m as string} className="flex justify-between"><span>{m as string}</span><span className="text-[var(--gold)]">AC {ac as number}</span></div>
                ))}
              </div>
            </div>
          </div>
        </ParchmentPanel>
      )}
    </div>
  );
}
