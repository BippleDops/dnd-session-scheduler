'use client';
import { type CharacterSheet as CharacterSheetType } from '@/lib/api';

const CLASS_ICONS: Record<string, string> = {
  Barbarian: '🪓', Bard: '🎵', Cleric: '✝️', Druid: '🌿', Fighter: '⚔️', Monk: '👊',
  Paladin: '🛡️', Ranger: '🏹', Rogue: '🗡️', Sorcerer: '✨', Warlock: '👁️', Wizard: '🧙',
  Artificer: '⚙️', 'Blood Hunter': '🩸',
};

function getClassTheme(charClass: string): string {
  const c = (charClass || '').split(',')[0].trim().toLowerCase();
  return `class-theme-${c}`;
}

function getHpState(hp: number, maxHp: number): string {
  if (maxHp <= 0) return 'healthy';
  const pct = hp / maxHp;
  if (pct > 0.5) return 'healthy';
  if (pct > 0.25) return 'wounded';
  return 'critical';
}

function abilityMod(val: number): string {
  const m = Math.floor((val - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

interface Props {
  character: CharacterSheetType;
}

export default function VisualCharacterSheet({ character: c }: Props) {
  const classIcon = CLASS_ICONS[c.class?.split(',')[0]?.trim()] || '⚔️';
  const hpPct = c.max_hp > 0 ? Math.round((c.hp / c.max_hp) * 100) : 100;
  const hpState = getHpState(c.hp, c.max_hp);

  return (
    <div className={`parchment p-4 md:p-6 ${getClassTheme(c.class)}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Portrait */}
        <div className="flex-shrink-0">
          {c.portrait_url ? (
            <img src={c.portrait_url} alt={c.name} className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover border-2 border-[var(--wood-dark)] shadow-lg" />
          ) : (
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg bg-[var(--wood-dark)] flex items-center justify-center text-4xl md:text-5xl shadow-lg">
              {classIcon}
            </div>
          )}
        </div>

        {/* Name & details */}
        <div className="flex-1 min-w-0">
          <h2 className="font-[var(--font-heading)] text-2xl md:text-3xl text-[var(--gold)] truncate">{c.name}</h2>
          <p className="text-sm md:text-base text-[var(--ink-faded)]">
            {c.race} {c.class}{c.subclass ? ` — ${c.subclass}` : ''}
          </p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[var(--gold)] font-[var(--font-heading)] text-lg">Level {c.level}</span>
            <span className={c.status === 'Active' ? 'text-green-600 text-xs font-bold' : 'text-red-600 text-xs font-bold'}>{c.status}</span>
          </div>

          {/* HP Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold">❤️ Hit Points</span>
              <span>{c.hp} / {c.max_hp}</span>
            </div>
            <div className="hp-heart-bar">
              <div className={`hp-heart-fill ${hpState}`} style={{ width: `${Math.min(hpPct, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* AC Shield */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="ac-shield">{c.ac}</div>
          <span className="text-[10px] text-[var(--ink-faded)]">AC</span>
        </div>
      </div>

      {/* Ability Scores — hex grid */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold text-[var(--ink-faded)] uppercase tracking-wide mb-3">Ability Scores</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 justify-items-center">
          {([
            ['STR', c.str], ['DEX', c.dex], ['CON', c.con],
            ['INT', c.int_], ['WIS', c.wis], ['CHA', c.cha],
          ] as const).map(([label, val]) => (
            <div key={label} className="ability-hex">
              <span className="text-[9px] font-bold text-[var(--ink-faded)] uppercase">{label}</span>
              <span className="text-lg font-bold text-[var(--ink)]">{val}</span>
              <span className="text-[10px] text-[var(--gold)] font-semibold">{abilityMod(val)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gold */}
      <div className="mt-4 flex items-center gap-4 text-sm">
        <span className="font-semibold text-[var(--ink)]">💰 Wealth:</span>
        <span className="text-[var(--gold)]">{c.gold}g</span>
        <span className="text-gray-400">{c.silver}s</span>
        <span className="text-amber-700">{c.copper}c</span>
      </div>

      {/* Proficiencies & Equipment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {c.proficiencies && (
          <div>
            <h3 className="text-xs font-semibold text-[var(--ink-faded)] uppercase tracking-wide mb-1">Proficiencies</h3>
            <p className="text-sm whitespace-pre-wrap">{c.proficiencies}</p>
          </div>
        )}
        {c.equipment && (
          <div>
            <h3 className="text-xs font-semibold text-[var(--ink-faded)] uppercase tracking-wide mb-1">Equipment</h3>
            <p className="text-sm whitespace-pre-wrap">{c.equipment}</p>
          </div>
        )}
      </div>

      {/* Backstory */}
      {c.backstory && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-[var(--ink-faded)] uppercase tracking-wide mb-1">Backstory</h3>
          <p className="text-sm italic leading-relaxed whitespace-pre-wrap">{c.backstory}</p>
        </div>
      )}
    </div>
  );
}
