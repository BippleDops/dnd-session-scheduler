'use client';
import { type Session } from '@/lib/api';
import { formatTime, campaignColor } from '@/lib/utils';

interface Props {
  sessions: Session[];
  position: { x: number; y: number };
}

export default function CalendarPopover({ sessions, position }: Props) {
  if (sessions.length === 0) return null;

  return (
    <div
      className="fixed z-[100] w-64 bg-[var(--wood-medium)] border border-[var(--gold)] rounded-lg shadow-2xl p-3 pointer-events-none"
      style={{
        left: Math.min(position.x, window.innerWidth - 280),
        top: position.y + 10,
      }}
    >
      {sessions.map((s, i) => {
        const full = s.spotsRemaining <= 0;
        return (
          <div key={i} className={`${i > 0 ? 'border-t border-[rgba(201,169,89,0.2)] pt-2 mt-2' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: campaignColor(s.campaign) }} />
              <span className="text-sm font-semibold text-[var(--gold)] truncate">{s.title || s.campaign}</span>
            </div>
            <p className="text-xs text-[var(--parchment-dark)] mt-0.5">
              {formatTime(s.startTime)} — {formatTime(s.endTime)}
            </p>
            <div className="flex justify-between items-center mt-1">
              <span className={`text-[10px] ${full ? 'text-red-400' : 'text-[var(--parchment-dark)]'}`}>
                {full ? 'Full' : `${s.spotsRemaining} spots open`}
              </span>
              {!full && (
                <span className="text-[10px] text-[var(--gold)] font-semibold">Click to view →</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
