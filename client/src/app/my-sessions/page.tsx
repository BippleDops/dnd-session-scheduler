'use client';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getMyRegistrations, cancelMyRegistration, getMyFeedToken } from '@/lib/api';
import { formatDate, formatTime, campaignColor } from '@/lib/utils';
import CandleLoader from '@/components/ui/CandleLoader';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WaxSeal from '@/components/ui/WaxSeal';
import WoodButton from '@/components/ui/WoodButton';
import { useToast } from '@/components/ui/Toast';

export default function MySessionsPage() {
  usePageTitle('My Quests');
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { data, loading, refetch } = useApi(getMyRegistrations);
  const { toast } = useToast();

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
    if (!confirm('Abandon this quest?')) return;
    const r = await cancelMyRegistration(regId);
    if (r.success) { toast('Quest cancelled', 'success'); refetch(); }
    else toast(r.message || 'Failed', 'error');
  };

  const handleSubscribe = async () => {
    const d = await getMyFeedToken();
    if (!d.token) { toast('Sign up for a session first', 'warning'); return; }
    navigator.clipboard.writeText(d.url);
    toast('Calendar feed URL copied!', 'success');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="scroll-heading text-3xl">🎒 My Quests</h1>
        <WoodButton variant="sm" onClick={handleSubscribe}>📅 Subscribe My Calendar</WoodButton>
      </div>

      {/* Upcoming */}
      <h2 className="scroll-heading text-xl mb-3">Upcoming Adventures</h2>
      {data?.upcoming.length === 0 ? (
        <ParchmentPanel className="text-center py-6">
          <p className="text-[var(--ink-faded)] italic">No upcoming quests. <a href="/sessions" className="text-[var(--gold)] underline">Browse the quest board!</a></p>
        </ParchmentPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {data?.upcoming.map(r => (
            <div key={r.registrationId} className="quest-card p-5 pt-6" style={{ borderLeft: `4px solid ${campaignColor(r.campaign)}` }}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-[var(--font-heading)] text-lg text-[var(--ink)]">{r.title || r.campaign}</h3>
                  <p className="text-sm text-[var(--ink-faded)]">{formatDate(r.date)} &bull; {formatTime(r.startTime)} — {formatTime(r.endTime)}</p>
                  <p className="text-sm text-[var(--ink)] mt-1">Playing as <strong>{r.characterName}</strong> ({r.characterClass} Lv.{r.characterLevel})</p>
                </div>
                <WaxSeal campaign={r.campaign} />
              </div>
              <div className="mt-3">
                <WoodButton variant="danger" onClick={() => handleCancel(r.registrationId)} className="text-xs">Cancel Quest</WoodButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past */}
      <h2 className="scroll-heading text-xl mb-3 mt-6">Past Adventures</h2>
      {data?.past.length === 0 ? (
        <ParchmentPanel className="text-center py-6">
          <p className="text-[var(--ink-faded)] italic">No past adventures yet.</p>
        </ParchmentPanel>
      ) : (
        <div className="parchment overflow-x-auto">
          <table className="w-full text-sm text-[var(--ink)]">
            <thead><tr className="border-b border-[var(--parchment-dark)]">
              <th className="text-left p-2 font-semibold">Date</th><th className="text-left p-2">Campaign</th><th className="text-left p-2">Character</th><th className="text-left p-2">Status</th>
            </tr></thead>
            <tbody>
              {data?.past.map(r => (
                <tr key={r.registrationId} className="border-b border-[rgba(0,0,0,0.05)]">
                  <td className="p-2">{formatDate(r.date)}</td>
                  <td className="p-2"><WaxSeal campaign={r.campaign} size={24} /></td>
                  <td className="p-2">{r.characterName} ({r.characterClass})</td>
                  <td className="p-2"><span className="tier-shield">{r.attended ? 'Attended' : r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Characters */}
      <h2 className="scroll-heading text-xl mb-3 mt-6">My Characters</h2>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        {data?.characters.map((c, i) => (
          <ParchmentPanel key={i}>
            <p className="font-[var(--font-heading)] text-[var(--gold)] text-lg">{c.characterName}</p>
            <p className="text-sm text-[var(--ink-faded)]">{c.characterClass} · Level {c.characterLevel}{c.characterRace ? ` · ${c.characterRace}` : ''}</p>
          </ParchmentPanel>
        ))}
      </div>
    </div>
  );
}

