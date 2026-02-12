'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getSessionRequests, createSessionRequest, voteSessionRequest, getCampaignsList, type SessionRequest, type Campaign } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';

export default function RequestsPage() {
  usePageTitle('Session Requests');
  const { isLoggedIn } = useAuth();
  const [requests, setRequests] = useState<SessionRequest[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ campaignId: '', preferredDate: '', message: '' });

  useEffect(() => {
    Promise.all([getSessionRequests(), getCampaignsList()]).then(([r, c]) => {
      setRequests(r); setCampaigns(c);
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSessionRequest(form);
    setShowForm(false);
    setForm({ campaignId: '', preferredDate: '', message: '' });
    getSessionRequests().then(setRequests);
  };

  const handleVote = async (id: string) => {
    await voteSessionRequest(id, []);
    getSessionRequests().then(setRequests);
  };

  if (loading) return <CandleLoader text="Loading requests..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">🙋 Session Requests</h1>
        {isLoggedIn && <WoodButton onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Request Session'}</WoodButton>}
      </div>

      {showForm && (
        <ParchmentPanel title="Request a Session">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1">Campaign</label>
              <select className="parchment-input w-full" value={form.campaignId} onChange={e => setForm({ ...form, campaignId: e.target.value })}>
                <option value="">Any campaign</option>
                {campaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Preferred Date</label>
              <input type="date" className="parchment-input w-full" value={form.preferredDate} onChange={e => setForm({ ...form, preferredDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Message</label>
              <textarea className="parchment-input w-full h-16" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="I'm free this weekend, anyone else?" />
            </div>
            <WoodButton type="submit">Submit Request</WoodButton>
          </form>
        </ParchmentPanel>
      )}

      {requests.length === 0 ? (
        <ParchmentPanel><p className="text-[var(--ink-faded)] text-center">No session requests yet. Be the first to request a game!</p></ParchmentPanel>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <ParchmentPanel key={r.request_id}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {r.photo_url ? <img src={r.photo_url} alt="" className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-[var(--wood-dark)] flex items-center justify-center">👤</div>}
                  <div>
                    <span className="font-bold">{r.player_name}</span>
                    {r.campaign_name && <span className="text-sm text-[var(--parchment-dark)] ml-2">{r.campaign_name}</span>}
                    {r.preferred_date && <p className="text-xs text-[var(--gold)]">Preferred: {r.preferred_date}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-[var(--gold)]">+{r.vote_count || r.upvotes}</span>
                  {isLoggedIn && <WoodButton variant="sm" onClick={() => handleVote(r.request_id)}>👍 I&apos;m in!</WoodButton>}
                </div>
              </div>
              {r.message && <p className="text-sm mt-2">{r.message}</p>}
            </ParchmentPanel>
          ))}
        </div>
      )}
    </div>
  );
}

