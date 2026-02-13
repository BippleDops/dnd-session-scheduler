'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getCampaignDetail, getCampaignRoster, getCampaignTimeline, type Campaign, type CampaignRosterEntry, type CampaignTimelineEntry } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import CandleLoader from '@/components/ui/CandleLoader';
import WaxSeal from '@/components/ui/WaxSeal';
import Link from 'next/link';

export default function CampaignHubPage() { return <Suspense><CampaignHubInner /></Suspense>; }
function CampaignHubInner() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') || '';
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [roster, setRoster] = useState<CampaignRosterEntry[]>([]);
  const [timeline, setTimeline] = useState<CampaignTimelineEntry[]>([]);
  const [tab, setTab] = useState<'overview' | 'roster' | 'timeline'>('overview');

  usePageTitle(campaign?.name || 'Campaign');

  useEffect(() => {
    if (!slug) return;
    getCampaignDetail(slug).then(setCampaign);
    getCampaignRoster(slug).then(setRoster);
    getCampaignTimeline(slug).then(setTimeline);
  }, [slug]);

  if (!campaign) return <CandleLoader text="Loading campaign..." />;

  return (
    <div className="space-y-6">
      {/* Campaign Banner */}
      <div className="relative overflow-hidden rounded-lg">
        {campaign.banner_url ? (
          <img src={campaign.banner_url} alt={campaign.name} className="w-full h-48 object-cover" />
        ) : (
          <div className="w-full h-48 bg-gradient-to-r from-[var(--wood-dark)] to-[var(--wood)] flex items-center justify-center">
            <WaxSeal campaign={campaign.name} size={72} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6">
          <div>
            <h1 className="font-[var(--font-heading)] text-4xl text-[var(--gold)] drop-shadow-lg">{campaign.name}</h1>
            {campaign.default_tier !== 'any' && (
              <span className="text-sm text-[var(--parchment-dark)]">Default Tier: {campaign.default_tier}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['overview', 'roster', 'timeline'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm font-[var(--font-heading)] transition-colors ${tab === t ? 'bg-[var(--gold)] text-[var(--wood-dark)]' : 'bg-[var(--wood)] text-[var(--parchment-dark)] hover:bg-[var(--wood-light)]'}`}>
            {t === 'overview' ? '📖 Overview' : t === 'roster' ? '⚔️ Roster' : '📜 Timeline'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campaign.description && (
            <ParchmentPanel title="About This Campaign" className="col-span-full">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{campaign.description}</p>
            </ParchmentPanel>
          )}

          {campaign.lore && (
            <ParchmentPanel title="World Lore">
              <p className="text-sm whitespace-pre-wrap leading-relaxed italic">{campaign.lore}</p>
            </ParchmentPanel>
          )}

          {campaign.house_rules && (
            <ParchmentPanel title="House Rules">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{campaign.house_rules}</p>
            </ParchmentPanel>
          )}

          {campaign.world_map_url && (
            <ParchmentPanel title="World Map" className="col-span-full">
              <img src={campaign.world_map_url} alt="World Map" className="w-full rounded-lg" />
            </ParchmentPanel>
          )}

          <ParchmentPanel title="Quick Stats">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <span className="block text-2xl font-bold text-[var(--gold)]">{roster.length}</span>
                <span className="text-xs text-[var(--ink-faded)]">Adventurers</span>
              </div>
              <div>
                <span className="block text-2xl font-bold text-[var(--gold)]">{timeline.length}</span>
                <span className="text-xs text-[var(--ink-faded)]">Sessions</span>
              </div>
            </div>
          </ParchmentPanel>
        </div>
      )}

      {tab === 'roster' && (
        <ParchmentPanel title={`Guild Roster (${roster.length})`}>
          {roster.length === 0 ? (
            <p className="text-[var(--ink-faded)] text-center">No adventurers yet.</p>
          ) : (
            <div className="space-y-3">
              {roster.map(p => (
                <div key={p.player_id} className="flex items-center gap-3 p-3 border-b border-[var(--wood-dark)] last:border-0">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--wood-dark)] flex items-center justify-center text-lg">👤</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Link href={`/player?id=${p.player_id}`} className="font-bold hover:text-[var(--gold)] transition-colors">{p.name}</Link>
                    <p className="text-xs text-[var(--ink-faded)]">{p.characters || 'No characters'}</p>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-[var(--gold)]">{p.session_count} sessions</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ParchmentPanel>
      )}

      {tab === 'timeline' && (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--gold)] opacity-30" />
          {timeline.length === 0 ? (
            <ParchmentPanel><p className="text-[var(--ink-faded)] text-center">No sessions recorded yet.</p></ParchmentPanel>
          ) : (
            <div className="space-y-4 pl-10">
              {timeline.map(s => (
                <div key={s.session_id} className="relative">
                  <div className="absolute -left-[26px] top-3 w-3 h-3 rounded-full bg-[var(--gold)] border-2 border-[var(--wood-dark)]" />
                  <ParchmentPanel>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-[var(--font-heading)] text-lg text-[var(--gold)]">{s.title || 'Untitled Session'}</h3>
                        <p className="text-xs text-[var(--ink-faded)]">{s.date} — {s.player_count} adventurers</p>
                        {s.characters && <p className="text-xs text-[var(--parchment-dark)] mt-1">{s.characters}</p>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${s.status === 'Completed' ? 'bg-green-900/30 text-green-400' : s.status === 'Cancelled' ? 'bg-red-900/30 text-red-400' : 'bg-[var(--gold)]/20 text-[var(--gold)]'}`}>
                        {s.status}
                      </span>
                    </div>
                    {s.dm_post_notes && <p className="text-sm mt-2 italic text-[var(--parchment-dark)]">{s.dm_post_notes.slice(0, 200)}{s.dm_post_notes.length > 200 ? '...' : ''}</p>}
                  </ParchmentPanel>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
