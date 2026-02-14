'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getSessions, getCampaignsList, type Session, type Campaign } from '@/lib/api';
import { formatDate, formatTime, campaignColor } from '@/lib/utils';
import { useSwipe } from '@/hooks/useSwipe';
import { CalendarSkeleton } from '@/components/ui/SessionSkeleton';
import QuestCard from '@/components/ui/QuestCard';
import WaxSeal from '@/components/ui/WaxSeal';
import { EmptyStateFromPreset } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function CalendarPage() {
  usePageTitle('Quest Board');
  const { isLoggedIn } = useAuth();
  const { data: sessions, loading } = useApi(getSessions);
  const { data: campaigns } = useApi(getCampaignsList);
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

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => changeMonth(1),
    onSwipeRight: () => changeMonth(-1),
  });

  const daySessions = selectedDate ? (sessionsByDate[selectedDate] || []) : [];
  const selectedRef = useRef<HTMLDivElement>(null);

  // Smooth scroll to selected day's sessions
  useEffect(() => {
    if (selectedDate && daySessions.length > 0 && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedDate, daySessions.length]);

  if (loading) return <CalendarSkeleton />;

  return (
    <div>
      {/* Hero banner for visitors */}
      {!isLoggedIn && (
        <div className="parchment p-6 mb-6 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="font-[var(--font-heading)] text-3xl text-[var(--ink)] mb-2">⚔️ Welcome to the Quest Board</h1>
            <p className="text-[var(--ink-faded)] max-w-lg mx-auto mb-4">
              Sign up for D&amp;D sessions, manage your characters, track your adventures, and coordinate with your party.
            </p>
            <a href="/auth/google" className="wood-btn wood-btn-primary no-underline inline-block text-sm">
              🎲 Sign In with Google to Join
            </a>
          </div>
        </div>
      )}

      {isLoggedIn && <h1 className="scroll-heading text-3xl mb-6">⚔️ Quest Board</h1>}

      {/* Next session highlight */}
      {isLoggedIn && sessions && sessions.length > 0 && (() => {
        const next = sessions.find(s => s.date >= todayStr && s.spotsRemaining > 0);
        if (!next) return null;
        return (
          <div className="parchment p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🗓️</span>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">Next available: <strong>{next.title || next.campaign}</strong></p>
                <p className="text-xs text-[var(--ink-faded)]">{formatDate(next.date)} · {formatTime(next.startTime)} · {next.spotsRemaining} spots open</p>
              </div>
            </div>
            <a href={`/signup?sessionId=${next.sessionId}`} className="wood-btn wood-btn-primary text-xs py-1 px-3 no-underline">Sign Up →</a>
          </div>
        );
      })()}

      {/* Calendar */}
      <div className="parchment p-5 mb-6" {...swipeHandlers}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeMonth(-1)} className="wood-btn text-sm py-1 px-3">← Prev</button>
          <div className="flex items-center gap-2">
            <h2 className="font-[var(--font-heading)] text-xl text-[var(--ink)]">{monthNames[month]} {year}</h2>
            {(month !== new Date().getMonth() || year !== new Date().getFullYear()) && (
              <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(null); }} className="text-xs text-[var(--gold)] hover:underline bg-transparent border-none cursor-pointer">Today</button>
            )}
          </div>
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
                onClick={() => hasSession && setSelectedDate(dateStr)}
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
                  <div className="flex gap-1 mt-1 flex-wrap items-center">
                    {daySess.map((s, j) => (
                      <div
                        key={j}
                        className={`w-2 h-2 rounded-full ${s.spotsRemaining <= 0 ? 'opacity-40' : ''}`}
                        style={{ backgroundColor: campaignColor(s.campaign) }}
                        title={`${s.title || s.campaign} — ${formatTime(s.startTime)} — ${s.spotsRemaining > 0 ? s.spotsRemaining + ' spots' : 'FULL'}`}
                      />
                    ))}
                    {daySess.length > 1 && <span className="text-[9px] text-[var(--ink-faded)]">{daySess.length}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend (dynamic from actual sessions) */}
        <div className="flex gap-4 justify-center mt-4 flex-wrap">
          {(() => {
            const campaignSet = new Set((sessions || []).map(s => s.campaign));
            return Array.from(campaignSet).map(c => (
              <div key={c} className="flex items-center gap-1 text-xs text-[var(--ink-faded)]">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: campaignColor(c) }} />
                {c}
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Selected day sessions */}
      {selectedDate && daySessions.length > 0 && (
        <div className="mb-6" ref={selectedRef}>
          <h2 className="scroll-heading text-xl mb-4">{formatDate(selectedDate)}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {daySessions.map((s, i) => <QuestCard key={s.sessionId} session={s} index={i} />)}
          </div>
        </div>
      )}

      {/* No sessions */}
      {(!sessions || sessions.length === 0) && (
        <EmptyStateFromPreset preset="sessions" />
      )}

      {/* Campaigns */}
      {campaigns && campaigns.length > 0 && (
        <div className="mt-8">
          <h2 className="scroll-heading text-xl mb-4">🗺️ Campaigns</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {campaigns.map(c => (
              <Link key={c.campaign_id} href={`/campaign?slug=${c.slug}`}
                className="parchment p-4 text-center no-underline hover:shadow-lg transition-shadow group">
                <WaxSeal campaign={c.name} size={40} />
                <p className="font-[var(--font-heading)] text-sm text-[var(--ink)] mt-2 group-hover:text-[var(--gold)] transition-colors">{c.name}</p>
                {c.description && <p className="text-[10px] text-[var(--ink-faded)] mt-1 line-clamp-2">{c.description}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
