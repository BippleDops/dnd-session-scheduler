'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getMyStats, getMyAchievements, type PlayerStats, type Achievement } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import CandleLoader from '@/components/ui/CandleLoader';

export default function StatsPage() {
  usePageTitle('Adventurer Stats');
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) return;
    Promise.all([getMyStats(), getMyAchievements()]).then(([s, a]) => {
      setStats(s);
      setAchievements(a);
    }).finally(() => setLoading(false));
  }, [isLoggedIn]);

  if (authLoading) return <CandleLoader text="Checking credentials..." />;
  if (!isLoggedIn) return <ParchmentPanel title="Sign In Required"><p>Please sign in.</p></ParchmentPanel>;
  if (loading) return <CandleLoader text="Consulting the oracle..." />;
  if (!stats) return <ParchmentPanel><p>No stats available.</p></ParchmentPanel>;

  const earned = achievements.filter(a => a.earned_at);
  const locked = achievements.filter(a => !a.earned_at);

  return (
    <div className="space-y-6">
      <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">📊 Adventurer Stats</h1>

      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Total Sessions', stats.totalSessions, '⚔️'],
          ['Attendance', `${stats.attendanceRate}%`, '✅'],
          ['Streak', stats.streak, '🔥'],
          ['Top Character', stats.mostPlayedCharacter, '🗡️'],
        ].map(([label, value, icon]) => (
          <ParchmentPanel key={label as string}>
            <div className="text-center">
              <span className="text-2xl">{icon as string}</span>
              <p className="text-2xl font-bold text-[var(--gold)] mt-1">{value as string}</p>
              <p className="text-xs text-[var(--ink-faded)]">{label as string}</p>
            </div>
          </ParchmentPanel>
        ))}
      </div>

      {/* Campaign distribution */}
      {stats.campaignDistribution.length > 0 && (
        <ParchmentPanel title="🗺️ Campaign Distribution">
          <div className="space-y-2">
            {stats.campaignDistribution.map(c => {
              const pct = stats.totalSessions > 0 ? Math.round((c.count / stats.totalSessions) * 100) : 0;
              return (
                <div key={c.campaign}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{c.campaign}</span>
                    <span className="text-[var(--gold)]">{c.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-[var(--wood-dark)] rounded overflow-hidden">
                    <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ParchmentPanel>
      )}

      {/* Achievements */}
      <ParchmentPanel title={`🏆 Achievements (${earned.length}/${achievements.length})`}>
        {earned.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {earned.map(a => (
              <div key={a.achievement_id} className="flex items-center gap-1 bg-[var(--gold)]/20 px-3 py-1.5 rounded border border-[var(--gold)]" title={a.description}>
                <span>{a.icon}</span>
                <span className="text-sm text-[var(--gold)] font-bold">{a.name}</span>
              </div>
            ))}
          </div>
        )}
        {locked.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {locked.map(a => (
              <div key={a.achievement_id} className="flex items-center gap-1 bg-[var(--wood-dark)] px-3 py-1.5 rounded opacity-50" title={a.description}>
                <span>🔒</span>
                <span className="text-sm">{a.name}</span>
              </div>
            ))}
          </div>
        )}
      </ParchmentPanel>
    </div>
  );
}

