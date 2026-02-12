'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getPolls, getPollDetail, votePoll, createPoll, getCampaignsList, type AvailabilityPoll, type AvailabilityPollDetail, type Campaign } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';
import { EmptyStateFromPreset } from '@/components/ui/EmptyState';

export default function PollsPage() { return <Suspense><PollsInner /></Suspense>; }

function PollsInner() {
  usePageTitle('Availability Polls');
  const searchParams = useSearchParams();
  const pollId = searchParams.get('poll') || '';
  const { isLoggedIn, isAdmin } = useAuth();
  const [polls, setPolls] = useState<AvailabilityPoll[]>([]);
  const [detail, setDetail] = useState<AvailabilityPollDetail | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ campaignId: '', title: '', options: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPolls(), getCampaignsList()]).then(([p, c]) => { setPolls(p); setCampaigns(c); }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (pollId) getPollDetail(pollId).then(setDetail); }, [pollId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const options = createForm.options.split('\n').map(o => o.trim()).filter(Boolean);
    await createPoll({ campaignId: createForm.campaignId || undefined, title: createForm.title, options });
    setShowCreate(false);
    getPolls().then(setPolls);
  };

  const handleVote = async () => {
    if (!detail) return;
    await votePoll(detail.poll_id, selected);
    getPollDetail(detail.poll_id).then(setDetail);
  };

  const toggleOption = (opt: string) => {
    setSelected(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);
  };

  if (loading) return <CandleLoader text="Loading polls..." />;

  // Build heatmap data
  const getOptionVoteCount = (option: string) => detail ? detail.votes.filter(v => v.selected_options.includes(option)).length : 0;
  const maxVotes = detail ? Math.max(...(detail.options || []).map(getOptionVoteCount), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">📅 Availability Polls</h1>
        {isAdmin && <WoodButton onClick={() => setShowCreate(!showCreate)}>{showCreate ? 'Cancel' : '+ New Poll'}</WoodButton>}
      </div>

      {showCreate && (
        <ParchmentPanel title="Create Poll">
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1">Title *</label>
              <input required className="parchment-input w-full" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} placeholder="When can you play next?" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Campaign</label>
              <select className="parchment-input w-full" value={createForm.campaignId} onChange={e => setCreateForm({ ...createForm, campaignId: e.target.value })}>
                <option value="">All campaigns</option>
                {campaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Options (one per line) *</label>
              <textarea required className="parchment-input w-full h-24" value={createForm.options} onChange={e => setCreateForm({ ...createForm, options: e.target.value })} placeholder="Saturday Feb 15, 6pm&#10;Sunday Feb 16, 2pm&#10;Saturday Feb 22, 6pm" />
            </div>
            <WoodButton type="submit">Create Poll</WoodButton>
          </form>
        </ParchmentPanel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Poll list */}
        <div className="space-y-2">
          {polls.length === 0 ? (
            <EmptyStateFromPreset preset="polls" />
          ) : polls.map(p => (
            <button key={p.poll_id} onClick={() => { getPollDetail(p.poll_id).then(setDetail); setSelected([]); }}
              className={`w-full text-left p-3 rounded transition-colors ${detail?.poll_id === p.poll_id ? 'bg-[var(--gold)]/20 border border-[var(--gold)]' : 'bg-[var(--wood-dark)] hover:bg-[var(--wood)]'}`}>
              <span className="font-bold text-sm">{p.title}</span>
              <div className="flex justify-between text-[10px] text-[var(--ink-faded)] mt-1">
                <span>{p.campaign_name || 'All'}</span>
                <span className={p.status === 'Open' ? 'text-green-400' : 'text-[var(--ink-faded)]'}>{p.status}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Poll detail + heatmap */}
        <div className="md:col-span-2">
          {detail ? (
            <ParchmentPanel title={detail.title}>
              <p className="text-sm text-[var(--parchment-dark)] mb-4">{detail.votes.length} responses</p>

              {/* Heatmap */}
              <div className="space-y-2 mb-4">
                {(detail.options || []).map(opt => {
                  const count = getOptionVoteCount(opt);
                  const pct = (count / maxVotes) * 100;
                  return (
                    <div key={opt}>
                      <div className="flex justify-between text-sm mb-1">
                        <button onClick={() => isLoggedIn && toggleOption(opt)}
                          className={`flex items-center gap-2 ${selected.includes(opt) ? 'text-[var(--gold)] font-bold' : ''}`}>
                          {isLoggedIn && <span>{selected.includes(opt) ? '✅' : '⬜'}</span>}
                          <span>{opt}</span>
                        </button>
                        <span className="text-[var(--gold)]">{count} votes</span>
                      </div>
                      <div className="h-3 bg-[var(--wood-dark)] rounded overflow-hidden">
                        <div className="h-full bg-green-600 transition-all rounded" style={{ width: `${pct}%`, opacity: 0.4 + (pct / 100) * 0.6 }} />
                      </div>
                      <div className="text-[10px] text-[var(--ink-faded)] mt-0.5">{detail.votes.filter(v => v.selected_options.includes(opt)).map(v => v.player_name).join(', ') || 'No votes'}</div>
                    </div>
                  );
                })}
              </div>

              {isLoggedIn && detail.status === 'Open' && (
                <WoodButton onClick={handleVote} disabled={selected.length === 0}>Submit Vote</WoodButton>
              )}
            </ParchmentPanel>
          ) : (
            <ParchmentPanel><p className="text-[var(--ink-faded)] text-center">Select a poll to view.</p></ParchmentPanel>
          )}
        </div>
      </div>
    </div>
  );
}

