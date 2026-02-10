'use client';
import { useState, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { getSessions, type Session } from '@/lib/api';
import { formatDate, formatTime, campaignColor } from '@/lib/utils';
import CandleLoader from '@/components/ui/CandleLoader';
import QuestCard from '@/components/ui/QuestCard';

export default function CalendarPage() {
  const { data: sessions, loading } = useApi(getSessions);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(year, month + delta, 1));
    setSelectedDate(null);
  };

  const pad = (n: number) => n < 10 ? '0' + n : '' + n;
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, []);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, Session[]> = {};
    (sessions || []).forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [sessions]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  if (loading) return <CandleLoader text="Consulting the oracle..." />;

  const daySessions = selectedDate ? (sessionsByDate[selectedDate] || []) : [];

  return (
    <div>
      <h1 className="scroll-heading text-3xl mb-6">⚔️ Quest Board</h1>

      {/* Calendar */}
      <div className="parchment p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeMonth(-1)} className="wood-btn text-sm py-1 px-3">← Prev</button>
          <h2 className="font-[var(--font-heading)] text-xl text-[var(--ink)]">{monthNames[month]} {year}</h2>
          <button onClick={() => changeMonth(1)} className="wood-btn text-sm py-1 px-3">Next →</button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-[var(--ink-faded)] py-1 uppercase tracking-wide">{d}</div>
          ))}

          {/* Previous month trailing */}
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`prev-${i}`} className="min-h-[60px] p-1 rounded bg-[rgba(0,0,0,0.03)] opacity-30">
              <span className="text-xs text-[var(--ink-faded)]">{daysInPrev - firstDay + i + 1}</span>
            </div>
          ))}

          {/* Current month */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;
            const daySess = sessionsByDate[dateStr] || [];
            const hasSession = daySess.length > 0;
            const isSelected = dateStr === selectedDate;

            return (
              <div
                key={day}
                onClick={() => hasSession && !isPast && setSelectedDate(dateStr)}
                className={`min-h-[60px] p-1 rounded border transition-all ${
                  isSelected ? 'border-[var(--gold)] bg-[rgba(201,169,89,0.1)]' :
                  isToday ? 'border-[var(--gold)] border-2' :
                  'border-transparent'
                } ${isPast ? 'opacity-30' : ''} ${
                  hasSession && !isPast ? 'cursor-pointer hover:bg-[rgba(201,169,89,0.05)]' : ''
                }`}
              >
                <span className={`text-xs font-semibold ${isToday ? 'text-[var(--gold)]' : 'text-[var(--ink-faded)]'}`}>{day}</span>
                {hasSession && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {daySess.map((s, j) => (
                      <div
                        key={j}
                        className={`w-2 h-2 rounded-full ${s.spotsRemaining <= 0 ? 'opacity-40' : ''}`}
                        style={{ backgroundColor: campaignColor(s.campaign) }}
                        title={`${s.title || s.campaign} — ${formatTime(s.startTime)} — ${s.spotsRemaining > 0 ? s.spotsRemaining + ' spots' : 'FULL'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 justify-center mt-4 flex-wrap">
          {['Aethermoor','Aquabyssos','Terravor','Two Cities'].map(c => (
            <div key={c} className="flex items-center gap-1 text-xs text-[var(--ink-faded)]">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: campaignColor(c) }} />
              {c}
            </div>
          ))}
        </div>
      </div>

      {/* Selected day sessions */}
      {selectedDate && daySessions.length > 0 && (
        <div className="mb-6">
          <h2 className="scroll-heading text-xl mb-4">{formatDate(selectedDate)}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {daySessions.map(s => <QuestCard key={s.sessionId} session={s} />)}
          </div>
        </div>
      )}

      {/* No sessions */}
      {(!sessions || sessions.length === 0) && (
        <div className="parchment p-10 text-center">
          <p className="font-[var(--font-heading)] text-xl text-[var(--ink)] mb-2">The quest board is empty...</p>
          <p className="text-[var(--ink-faded)] italic">Check back soon, adventurer. New quests are posted regularly.</p>
        </div>
      )}
    </div>
  );
}
