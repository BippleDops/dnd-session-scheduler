'use client';
import { useState, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getRecaps, getCampaigns } from '@/lib/api';
import { formatDate, campaignColor } from '@/lib/utils';
import CandleLoader from '@/components/ui/CandleLoader';
import WaxSeal from '@/components/ui/WaxSeal';
import { EmptyStateFromPreset } from '@/components/ui/EmptyState';

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
        <EmptyStateFromPreset preset="recaps" />
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
              <RecapText text={r.recap} />
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

function RecapText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 300;
  const displayText = isLong && !expanded ? text.slice(0, 300) + '...' : text;
  const readTime = Math.max(1, Math.ceil(text.split(/\s+/).length / 200));

  return (
    <div className="mt-3">
      <p className="text-[var(--ink)] text-sm leading-relaxed whitespace-pre-wrap">{displayText}</p>
      <div className="flex items-center gap-3 mt-2">
        {isLong && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-[var(--gold)] hover:underline bg-transparent border-none cursor-pointer">
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
        <span className="text-[10px] text-[var(--ink-faded)]">~{readTime} min read</span>
      </div>
    </div>
  );
}

