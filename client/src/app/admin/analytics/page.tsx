'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAdminAnalytics, type AnalyticsData } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import CandleLoader from '@/components/ui/CandleLoader';

export default function AnalyticsPage() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    getAdminAnalytics().then(setData).finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) return <ParchmentPanel title="Access Denied"><p>Admin only.</p></ParchmentPanel>;
  if (loading) return <CandleLoader text="Crunching numbers..." />;
  if (!data) return <ParchmentPanel><p>No data available.</p></ParchmentPanel>;

  const maxMonthly = Math.max(...data.sessionsPerMonth.map(s => s.count), 1);

  return (
    <div className="space-y-6">
      <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">📈 Analytics</h1>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Avg Attendance', data.avgAttendance, '👥'],
          ['Busiest Day', data.busiestDay, '📅'],
          ['Player Retention', `${data.playerRetention}%`, '🔄'],
          ['Campaigns', data.campaignDistribution.length, '🗺️'],
        ].map(([label, value, icon]) => (
          <ParchmentPanel key={label as string}>
            <div className="text-center">
              <span className="text-2xl">{icon as string}</span>
              <p className="text-2xl font-bold text-[var(--gold)] mt-1">{String(value)}</p>
              <p className="text-xs text-[var(--ink-faded)]">{label as string}</p>
            </div>
          </ParchmentPanel>
        ))}
      </div>

      {/* Sessions per month - bar chart */}
      <ParchmentPanel title="Sessions Per Month">
        <div className="flex items-end gap-1 h-40">
          {data.sessionsPerMonth.map(s => (
            <div key={s.month} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[10px] text-[var(--gold)] mb-1">{s.count}</span>
              <div className="w-full bg-[var(--gold)] rounded-t transition-all" style={{ height: `${(s.count / maxMonthly) * 100}%`, minHeight: s.count > 0 ? '4px' : '0' }} />
              <span className="text-[10px] text-[var(--ink-faded)] mt-1 truncate w-full text-center">{s.month.slice(5)}</span>
            </div>
          ))}
        </div>
      </ParchmentPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Campaign distribution */}
        <ParchmentPanel title="Campaign Distribution">
          <div className="space-y-2">
            {data.campaignDistribution.map(c => {
              const total = data.campaignDistribution.reduce((a, b) => a + b.count, 0);
              const pct = total > 0 ? Math.round((c.count / total) * 100) : 0;
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

        {/* Top players */}
        <ParchmentPanel title="🏆 Top Adventurers">
          <div className="space-y-2">
            {data.topPlayers.map((p, i) => (
              <div key={p.name} className="flex justify-between items-center p-2 bg-[var(--wood-dark)] rounded">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--gold)] font-bold w-5 text-center">{i + 1}</span>
                  <span>{p.name}</span>
                </div>
                <span className="text-sm text-[var(--gold)]">{p.sessions} sessions</span>
              </div>
            ))}
          </div>
        </ParchmentPanel>
      </div>
    </div>
  );
}

