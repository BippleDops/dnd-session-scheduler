'use client';
import { type Session } from '@/lib/api';
import { formatDate, formatTime, campaignColor } from '@/lib/utils';
import { useCountdown } from '@/hooks/useCountdown';
import WaxSeal from './WaxSeal';
import TierShield from './TierShield';
import WoodButton from './WoodButton';

interface Props {
  session: Session;
  showSignup?: boolean;
  index?: number; // for stagger animation
}

export default function QuestCard({ session: s, showSignup = true, index = 0 }: Props) {
  const spotsLow = s.spotsRemaining > 0 && s.spotsRemaining <= 2;
  const full = s.spotsRemaining <= 0;
  const capacityPct = s.maxPlayers > 0 ? Math.round((s.registeredCount / s.maxPlayers) * 100) : 0;
  const countdown = useCountdown(s.date, s.startTime);

  return (
    <div
      className="quest-card p-5 pt-6 card-enter"
      style={{
        borderLeft: `4px solid ${campaignColor(s.campaign)}`,
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <a href={`/session?id=${s.sessionId}`} className="font-[var(--font-heading)] text-lg text-[var(--ink)] mb-1 hover:text-[var(--gold)] transition-colors no-underline block">
            {s.title || s.campaign}
          </a>
          <p className="text-sm text-[var(--ink-faded)]">
            {formatDate(s.date)} &bull; {formatTime(s.startTime)} — {formatTime(s.endTime)}
          </p>
        </div>
        <WaxSeal campaign={s.campaign} />
      </div>

      {/* Countdown */}
      {countdown && !countdown.isPast && (
        <div className={`mt-2 text-xs font-semibold flex items-center gap-1 ${countdown.isUrgent ? 'text-[var(--candle)]' : 'text-[var(--gold)]'}`}>
          <span>⏳</span>
          <span>Starts in {countdown.label}</span>
        </div>
      )}

      {/* Signup deadline */}
      {s.signupDeadline && new Date(s.signupDeadline) > new Date() && (
        <p className="mt-2 text-[10px] text-[var(--candle)]">⏰ Signup closes {new Date(s.signupDeadline).toLocaleDateString()}</p>
      )}

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

      {/* Capacity bar */}
      <div className="mt-3">
        <div className="flex justify-between items-center text-xs mb-1">
          <span className={spotsLow ? 'text-[var(--candle)] font-bold' : 'text-[var(--ink-faded)]'}>
            {spotsLow && '⚠️ '}{s.registeredCount} / {s.maxPlayers} spots
          </span>
          {full && <span className="text-red-500 font-bold uppercase text-[10px]">Full</span>}
        </div>
        <div className="h-1.5 bg-[var(--parchment-dark)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full capacity-bar-fill ${
              full ? 'bg-red-500 capacity-urgent' :
              spotsLow ? 'bg-[var(--candle)]' :
              'bg-[var(--gold)]'
            }`}
            style={{ width: `${Math.min(capacityPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex justify-end gap-2">
        <WoodButton variant="sm" onClick={() => window.location.href = `/api/sessions/${s.sessionId}/ics`}>
          📅
        </WoodButton>
        {countdown && countdown.isUrgent && (
          <WoodButton variant="sm" href={`/session/live?sessionId=${s.sessionId}`}>⚡ Live</WoodButton>
        )}
        {showSignup && !full && (
          <WoodButton variant="primary" href={`/signup?sessionId=${s.sessionId}`}>Sign Up</WoodButton>
        )}
      </div>
    </div>
  );
}
