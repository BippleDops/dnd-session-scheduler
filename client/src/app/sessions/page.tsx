'use client';
import { useState, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getSessions, type Session } from '@/lib/api';
import { SessionGridSkeleton } from '@/components/ui/SessionSkeleton';
import QuestCard from '@/components/ui/QuestCard';
import WoodButton from '@/components/ui/WoodButton';
import { EmptyStateFromPreset } from '@/components/ui/EmptyState';

export default function SessionsPage() {
  usePageTitle('Sessions');
  const { data: sessions, loading } = useApi(getSessions);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const feedUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/feed.ics` : '';

  // Dynamic campaign list from data
  const campaigns = useMemo(() => {
    const set = new Set((sessions || []).map(s => s.campaign));
    return Array.from(set).sort();
  }, [sessions]);

  // Filter sessions
  const filtered = useMemo(() => {
    return (sessions || []).filter(s => {
      if (filterCampaign && s.campaign !== filterCampaign) return false;
      if (filterTier && (s.levelTier || 'any') !== filterTier) return false;
      return true;
    });
  }, [sessions, filterCampaign, filterTier]);

  if (loading) return <SessionGridSkeleton />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="scroll-heading text-3xl">📜 Upcoming Sessions</h1>
        <WoodButton variant="sm" onClick={() => setShowSubscribe(!showSubscribe)}>📅 Subscribe</WoodButton>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)} className="tavern-input max-w-[160px] text-sm">
          <option value="">All Campaigns</option>
          {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)} className="tavern-input max-w-[160px] text-sm">
          <option value="">All Tiers</option>
          <option value="any">Any Level</option>
          <option value="tier1">Tier 1 (Lv 1-4)</option>
          <option value="tier2">Tier 2 (Lv 5-10)</option>
          <option value="tier3">Tier 3 (Lv 11-16)</option>
          <option value="tier4">Tier 4 (Lv 17-20)</option>
        </select>
        {(filterCampaign || filterTier) && (
          <button onClick={() => { setFilterCampaign(''); setFilterTier(''); }} className="text-xs text-[var(--gold)] hover:underline bg-transparent border-none cursor-pointer">Clear filters</button>
        )}
        <span className="text-xs text-[var(--parchment-dark)] self-center ml-auto">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {showSubscribe && (
        <div className="parchment p-4 mb-4">
          <p className="text-sm text-[var(--ink)] mb-2">Paste this URL into Google Calendar, Apple Calendar, or Outlook:</p>
          <input type="text" readOnly value={feedUrl} className="tavern-input text-center text-sm"
            onClick={e => { (e.target as HTMLInputElement).select(); navigator.clipboard.writeText(feedUrl); }} />
          <p className="text-xs text-[var(--ink-faded)] mt-1 text-center">
            Or <a href={feedUrl.replace('https://', 'webcal://').replace('http://', 'webcal://')} className="text-[var(--gold)] underline">open in your calendar app</a>
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyStateFromPreset preset="sessions" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((s, i) => <QuestCard key={s.sessionId} session={s} index={i} />)}
        </div>
      )}
    </div>
  );
}
