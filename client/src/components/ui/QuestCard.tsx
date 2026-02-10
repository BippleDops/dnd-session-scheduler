'use client';
import { type Session } from '@/lib/api';
import { formatDate, formatTime, campaignColor } from '@/lib/utils';
import WaxSeal from './WaxSeal';
import TierShield from './TierShield';
import WoodButton from './WoodButton';

interface Props {
  session: Session;
  showSignup?: boolean;
}

export default function QuestCard({ session: s, showSignup = true }: Props) {
  const spotsLow = s.spotsRemaining > 0 && s.spotsRemaining <= 2;
  const full = s.spotsRemaining <= 0;

  return (
    <div className="quest-card p-5 pt-6" style={{ borderLeft: `4px solid ${campaignColor(s.campaign)}` }}>
      {/* Header */}
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="font-[var(--font-heading)] text-lg text-[var(--ink)] mb-1">
            {s.title || s.campaign}
          </h3>
          <p className="text-sm text-[var(--ink-faded)]">
            {formatDate(s.date)} &bull; {formatTime(s.startTime)} — {formatTime(s.endTime)}
          </p>
        </div>
        <WaxSeal campaign={s.campaign} />
      </div>

      {/* Tier + Description */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {s.levelTier && s.levelTier !== 'any' && <TierShield tier={s.levelTier} />}
        {s.location && <span className="text-xs text-[var(--ink-faded)]">📍 {s.location}</span>}
      </div>
      {s.description && (
        <p className="mt-2 text-sm text-[var(--ink-faded)] italic">{s.description}</p>
      )}

      {/* Roster */}
      {s.roster.length > 0 && (
        <div className="mt-3 border-t border-[var(--parchment-dark)] pt-3">
          <p className="text-xs font-semibold text-[var(--ink-faded)] uppercase tracking-wide mb-2">Adventuring Party</p>
          {s.roster.map((r, i) => (
            <div key={i} className="flex justify-between text-sm py-1 border-b border-[rgba(0,0,0,0.05)] last:border-0">
              <span className="font-semibold text-[var(--ink)]">{r.characterName}</span>
              <span className="text-[var(--ink-faded)]">{r.characterClass} Lv.{r.characterLevel}</span>
            </div>
          ))}
        </div>
      )}

      {/* Capacity + Action */}
      <div className="mt-3 flex justify-between items-center">
        <span className={`text-sm ${spotsLow ? 'text-[var(--candle)] font-bold' : 'text-[var(--ink-faded)]'}`}>
          {spotsLow && '⚠️ '}{s.registeredCount} / {s.maxPlayers} spots filled
        </span>
        <div className="flex gap-2">
          <WoodButton variant="sm" onClick={() => window.location.href = `/api/sessions/${s.sessionId}/ics`}>
            📅
          </WoodButton>
          {showSignup && (
            full
              ? <span className="text-xs text-red-400 font-semibold uppercase">Full</span>
              : <WoodButton variant="primary" href={`/signup?sessionId=${s.sessionId}`}>Sign Up</WoodButton>
          )}
        </div>
      </div>
    </div>
  );
}

