'use client';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getAdminAnalytics, type AnalyticsData } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import CandleLoader from '@/components/ui/CandleLoader';
import { EmptyStateFromPreset } from '@/components/ui/EmptyState';

export default function AnalyticsPage() {
  usePageTitle('Analytics');
  const { isAdmin, loading: authLoading } = useAuth();
  const { data, loading, error } = useApi(getAdminAnalytics);

  if (authLoading) return <CandleLoader text="Checking credentials..." />;
  if (!isAdmin) return <ParchmentPanel title="Access Denied"><p>Admin only.</p></ParchmentPanel>;
  if (loading) return <CandleLoader text="Crunching numbers..." />;
  if (error || !data) return <ParchmentPanel><p className="text-[var(--ink-faded)]">Failed to load analytics: {error || 'No data'}</p></ParchmentPanel>;

  const sessionsPerMonth = data.sessionsPerMonth || [];
  const campaignDist = data.campaignDistribution || [];
  const topPlayers = data.topPlayers || [];
  const maxMonthly = sessionsPerMonth.length > 0 ? Math.max(...sessionsPerMonth.map(s => s.count), 1) : 1;

  return (
    <div className="space-y-6">
      <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">📈 Analytics</h1>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Avg Attendance', data.avgAttendance || 0, '👥'],
          ['Busiest Day', data.busiestDay || 'N/A', '📅'],
          ['Player Retention', `${data.playerRetention || 0}%`, '🔄'],
          ['Campaigns', campaignDist.length, '🗺️'],
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
      {sessionsPerMonth.length > 0 ? (
        <ParchmentPanel title="Sessions Per Month">
          <div className="flex items-end gap-1 h-40">
            {sessionsPerMonth.map(s => (
              <div key={s.month} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-[10px] text-[var(--gold)] mb-1">{s.count}</span>
                <div className="w-full bg-[var(--gold)] rounded-t transition-all" style={{ height: `${(s.count / maxMonthly) * 100}%`, minHeight: s.count > 0 ? '4px' : '0' }} />
                <span className="text-[10px] text-[var(--ink-faded)] mt-1 truncate w-full text-center">{s.month?.slice(5) || '?'}</span>
              </div>
            ))}
          </div>
        </ParchmentPanel>
      ) : (
        <ParchmentPanel title="Sessions Per Month">
          <p className="text-center text-[var(--ink-faded)] py-6 italic">No session data yet. Create and complete sessions to see trends.</p>
        </ParchmentPanel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Campaign distribution */}
        <ParchmentPanel title="Campaign Distribution">
          {campaignDist.length === 0 ? (
            <p className="text-center text-[var(--ink-faded)] py-4 italic">No campaigns yet.</p>
          ) : (
            <div className="space-y-2">
              {campaignDist.map(c => {
                const total = campaignDist.reduce((a, b) => a + b.count, 0);
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
          )}
        </ParchmentPanel>

        {/* Top players */}
        <ParchmentPanel title="🏆 Top Adventurers">
          {topPlayers.length === 0 ? (
            <p className="text-center text-[var(--ink-faded)] py-4 italic">No adventurers have completed sessions yet.</p>
          ) : (
            <div className="space-y-2">
              {topPlayers.map((p, i) => (
                <div key={p.name} className="flex justify-between items-center p-2 bg-[var(--wood-dark)] rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--gold)] font-bold w-5 text-center">{i + 1}</span>
                    <span>{p.name}</span>
                  </div>
                  <span className="text-sm text-[var(--gold)]">{p.sessions} sessions</span>
                </div>
              ))}
            </div>
          )}
        </ParchmentPanel>
      </div>
    </div>
  );
}
