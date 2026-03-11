'use client';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getMyRegistrations, cancelMyRegistration } from '@/lib/api';
import { formatDate, formatTime, campaignColor } from '@/lib/utils';
import CandleLoader from '@/components/ui/CandleLoader';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WaxSeal from '@/components/ui/WaxSeal';
import WoodButton from '@/components/ui/WoodButton';
import { EmptyStateFromPreset } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  Pending: { label: '⏳ Pending Approval', color: 'text-yellow-500' },
  Confirmed: { label: '✅ Approved', color: 'text-green-500' },
  Waitlisted: { label: '📋 Waitlisted', color: 'text-blue-400' },
  Attended: { label: '✓ Attended', color: 'text-green-600' },
  'No-Show': { label: '✗ No-Show', color: 'text-red-400' },
  Cancelled: { label: '✗ Cancelled', color: 'text-red-400' },
};

export default function MySessionsPage() {
  usePageTitle('My Quests');
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { data, loading, refetch } = useApi(getMyRegistrations);
  const { toast } = useToast();
  const confirm = useConfirm();

  if (authLoading) return <CandleLoader text="Checking credentials..." />;
  if (!isLoggedIn) return (
    <ParchmentPanel className="text-center py-10">
      <h2 className="font-[var(--font-heading)] text-xl text-[var(--ink)]">Sign In to View Your Quests</h2>
      <p className="text-[var(--ink-faded)] mt-2">Your quest log awaits, adventurer.</p>
      <WoodButton variant="primary" href="/auth/google" className="mt-4">Sign In with Google</WoodButton>
    </ParchmentPanel>
  );

  if (loading) return <CandleLoader text="Opening your quest log..." />;

  const handleCancel = async (regId: string) => {
    const ok = await confirm({ title: 'Cancel Registration?', message: 'Are you sure? Your spot will be freed.', confirmLabel: 'Cancel Registration', variant: 'danger' });
    if (!ok) return;
    const r = await cancelMyRegistration(regId);
    if (r.success) { toast('Cancelled', 'success'); refetch(); }
    else toast(r.message || 'Failed', 'error');
  };

  return (
    <div>
      <h1 className="scroll-heading text-3xl mb-6">🎒 My Sessions</h1>

      {/* Upcoming */}
      <h2 className="scroll-heading text-xl mb-3">Upcoming</h2>
      {data?.upcoming.length === 0 ? (
        <EmptyStateFromPreset preset="quests" action={{ label: 'Browse Sessions', href: '/sessions' }} />
      ) : (
        <div className="space-y-3 mb-6">
          {data?.upcoming.map(r => {
            const badge = STATUS_BADGES[r.status] || { label: r.status, color: '' };
            return (
              <div key={r.registrationId} className="quest-card p-4 card-enter" style={{ borderLeft: `4px solid ${campaignColor(r.campaign)}` }}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <a href={`/session?id=${r.sessionId}`} className="font-[var(--font-heading)] text-lg text-[var(--ink)] hover:text-[var(--gold)] no-underline transition-colors block">{r.title || r.campaign}</a>
                    <p className="text-sm text-[var(--ink-faded)]">{formatDate(r.date)} · {formatTime(r.startTime)}</p>
                    <p className="text-sm text-[var(--ink)] mt-1">{r.characterName} ({r.characterClass} Lv.{r.characterLevel})</p>
                    <p className={`text-xs font-semibold mt-1 ${badge.color}`}>{badge.label}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <WaxSeal campaign={r.campaign} size={28} />
                    {(r.status === 'Confirmed' || r.status === 'Pending') && (
                      <WoodButton variant="danger" onClick={() => handleCancel(r.registrationId)} className="text-[10px] py-0.5 px-2">Cancel</WoodButton>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Past */}
      <h2 className="scroll-heading text-xl mb-3">Past Sessions</h2>
      {data?.past.length === 0 ? (
        <ParchmentPanel className="text-center py-6">
          <p className="text-[var(--ink-faded)] italic">No past sessions yet.</p>
        </ParchmentPanel>
      ) : (
        <div className="space-y-2">
          {data?.past.map(r => (
            <a key={r.registrationId} href={`/session?id=${r.sessionId}`}
              className="flex items-center justify-between p-3 parchment no-underline hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <WaxSeal campaign={r.campaign} size={24} />
                <div>
                  <span className="text-sm font-semibold text-[var(--ink)]">{r.title || r.campaign}</span>
                  <span className="text-xs text-[var(--ink-faded)] ml-2">{formatDate(r.date)}</span>
                </div>
              </div>
              <span className="text-xs text-[var(--ink-faded)]">{r.characterName} · {r.attended ? '✓ Attended' : r.status}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
