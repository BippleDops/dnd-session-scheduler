'use client';
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getRecaps, getCampaigns } from '@/lib/api';
import { formatDate, campaignColor } from '@/lib/utils';
import CandleLoader from '@/components/ui/CandleLoader';
import WaxSeal from '@/components/ui/WaxSeal';

export default function RecapsPage() {
  usePageTitle('Session Recaps');
  const [campaign, setCampaign] = useState('');
  const { data: recaps, loading } = useApi(() => getRecaps(campaign || undefined), [campaign]);
  const { data: campaigns } = useApi(getCampaigns);

  if (loading) return <CandleLoader text="Opening the campaign journal..." />;

  return (
    <div>
      <h1 className="scroll-heading text-3xl mb-6">📖 Session Recaps</h1>

      <div className="flex gap-3 mb-6">
        <select value={campaign} onChange={e => setCampaign(e.target.value)} className="tavern-input max-w-xs">
          <option value="">All Campaigns</option>
          {(campaigns || []).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {(!recaps || recaps.length === 0) ? (
        <div className="parchment p-10 text-center">
          <p className="font-[var(--font-heading)] text-xl text-[var(--ink)]">No session recaps yet.</p>
          <p className="text-[var(--ink-faded)] italic mt-2">Tales of past adventures will appear here once the DM writes them.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {recaps.map(r => (
            <div key={r.sessionId} className="quest-card p-5 pt-6" style={{ borderLeft: `4px solid ${campaignColor(r.campaign)}` }}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-[var(--font-heading)] text-lg text-[var(--ink)]">{r.campaign}</h3>
                  <p className="text-sm text-[var(--ink-faded)]">{formatDate(r.date)} &bull; {r.attendeeCount} adventurers</p>
                </div>
                <WaxSeal campaign={r.campaign} />
              </div>
              <div className="mt-3 text-[var(--ink)] text-sm leading-relaxed whitespace-pre-wrap">{r.recap}</div>
              {r.attendees && (
                <p className="mt-3 text-xs text-[var(--ink-faded)]">Adventurers: {r.attendees}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

