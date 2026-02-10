'use client';
import { useApi } from '@/hooks/useApi';
import { getAdminDashboard, triggerReminders, triggerBackup } from '@/lib/api';
import { formatDate, formatTime, formatTimestamp, campaignColor } from '@/lib/utils';
import CandleLoader from '@/components/ui/CandleLoader';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import { useToast } from '@/components/ui/Toast';

export default function AdminDashboard() {
  const { data, loading } = useApi(getAdminDashboard);
  const { toast } = useToast();

  if (loading) return <CandleLoader text="Consulting the DM's war table..." />;
  if (!data) return <ParchmentPanel className="text-center py-10"><p className="text-[var(--ink)]">Failed to load dashboard.</p></ParchmentPanel>;

  return (
    <div>
      <h1 className="scroll-heading text-3xl mb-6">🏰 DM War Table</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Upcoming', value: data.upcomingCount, icon: '⚔️' },
          { label: 'Active Players', value: data.activePlayerCount, icon: '👥' },
          { label: 'This Week', value: data.sessionsThisWeek, icon: '📅' },
          { label: 'This Month', value: data.sessionsThisMonth, icon: '📆' },
          { label: 'Last Backup', value: data.lastBackup ? formatTimestamp(data.lastBackup) : 'Never', icon: '💾' },
        ].map(s => (
          <ParchmentPanel key={s.label} className="text-center">
            <div className="text-2xl">{s.icon}</div>
            <div className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">{s.value}</div>
            <div className="text-xs text-[var(--ink-faded)] uppercase tracking-wide">{s.label}</div>
          </ParchmentPanel>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap mb-6">
        <WoodButton variant="primary" href="/admin/sessions?action=create">+ Create Session</WoodButton>
        <WoodButton href="/admin/players">View Players</WoodButton>
        <WoodButton href="/admin/history">View History</WoodButton>
        <WoodButton onClick={async () => { await triggerReminders(); toast('Reminders sent!', 'success'); }}>Run Reminders</WoodButton>
        <WoodButton onClick={async () => { await triggerBackup(); toast('Backup started!', 'success'); }}>Run Backup</WoodButton>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* This week */}
        <div>
          <h2 className="scroll-heading text-xl mb-3">This Week&apos;s Sessions</h2>
          {data.thisWeekSessions.length === 0 ? (
            <ParchmentPanel className="text-center py-6"><p className="text-[var(--ink-faded)] italic">No sessions this week</p></ParchmentPanel>
          ) : data.thisWeekSessions.map(s => (
            <ParchmentPanel key={s.sessionId} className="!mb-2" pinned>
              <div className="flex justify-between items-center">
                <div>
                  <strong className="text-[var(--ink)]">{s.title || s.campaign}</strong>
                  <p className="text-xs text-[var(--ink-faded)]">{formatDate(s.date)} &bull; {formatTime(s.startTime)}</p>
                </div>
                <span className="text-sm text-[var(--ink-faded)]">{s.registeredCount}/{s.maxPlayers}</span>
              </div>
            </ParchmentPanel>
          ))}
        </div>

        {/* Recent logs */}
        <div>
          <h2 className="scroll-heading text-xl mb-3">Recent Activity</h2>
          <ParchmentPanel className="max-h-96 overflow-y-auto">
            {data.recentLogs.length === 0 ? (
              <p className="text-center text-[var(--ink-faded)] italic py-4">No activity yet</p>
            ) : data.recentLogs.map((l, i) => (
              <div key={i} className="py-2 border-b border-[rgba(0,0,0,0.05)] last:border-0">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-[var(--ink)]">{l.ActionType}</span>
                  <span className="text-[var(--ink-faded)] text-xs">{formatTimestamp(l.Timestamp)}</span>
                </div>
                <p className="text-xs text-[var(--ink-faded)]">{l.Details}</p>
              </div>
            ))}
          </ParchmentPanel>
        </div>
      </div>
    </div>
  );
}

