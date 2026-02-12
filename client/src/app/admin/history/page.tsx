'use client';
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getAdminHistory, updateHistoryNotes, getCampaigns } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import CandleLoader from '@/components/ui/CandleLoader';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WaxSeal from '@/components/ui/WaxSeal';
import WoodButton from '@/components/ui/WoodButton';
import { useToast } from '@/components/ui/Toast';

export default function AdminHistoryPage() {
  usePageTitle('Session History');
  const [filterCampaign, setFilterCampaign] = useState('');
  const { data: history, loading } = useApi(() => getAdminHistory(filterCampaign ? { campaign: filterCampaign } : undefined), [filterCampaign]);
  const { data: campaigns } = useApi(getCampaigns);
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const selected = (history || []).find(h => h.sessionId === selectedId);

  if (loading) return <CandleLoader text="Opening the campaign journal..." />;

  return (
    <div>
      <h1 className="scroll-heading text-3xl mb-6">📖 Campaign Journal</h1>
      <div className="flex gap-3 mb-4">
        <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)} className="tavern-input max-w-[200px]">
          <option value="">All Campaigns</option>
          {(campaigns || []).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <WoodButton variant="sm" onClick={() => window.location.href = '/api/admin/export/history'}>Export CSV</WoodButton>
      </div>

      <div className="parchment overflow-x-auto mb-4">
        <table className="w-full text-sm text-[var(--ink)]">
          <thead><tr className="border-b-2 border-[var(--parchment-dark)]"><th className="text-left p-2">Date</th><th className="text-left p-2">Campaign</th><th className="text-left p-2">Attendees</th><th className="p-2">Count</th><th className="p-2">Recap</th></tr></thead>
          <tbody>
            {(history || []).length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-[var(--ink-faded)] italic">No completed sessions. Sessions appear here after being marked completed.</td></tr>
            ) : (history || []).map(h => (
              <tr key={h.sessionId} className="border-b border-[rgba(0,0,0,0.05)] cursor-pointer hover:bg-[rgba(201,169,89,0.05)]" onClick={() => { setSelectedId(h.sessionId); setNotes(h.dmPostNotes); }}>
                <td className="p-2">{formatDate(h.sessionDate)}</td>
                <td className="p-2"><WaxSeal campaign={h.campaign} size={20} /></td>
                <td className="p-2 text-xs">{h.attendeeCharNames || '—'}</td>
                <td className="p-2 text-center">{h.attendeeCount}</td>
                <td className="p-2 text-center">{h.recapDrafted ? '✅' : '❌'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ParchmentPanel>
          <h3 className="font-[var(--font-heading)] text-lg text-[var(--gold)] mb-3">{selected.campaign} — {formatDate(selected.sessionDate)}</h3>
          <p className="text-sm text-[var(--ink)] mb-3"><strong>Attendees ({selected.attendeeCount}):</strong> {selected.attendeeCharNames || 'None'}</p>
          <label className="block text-sm font-semibold text-[var(--ink)] mb-1">DM Post-Session Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="tavern-input" rows={4} />
          <WoodButton variant="primary" className="mt-2" onClick={async () => {
            const r = await updateHistoryNotes(selected.sessionId, notes);
            if (r.success) toast('Notes saved!', 'success'); else toast(r.message || 'Failed', 'error');
          }}>Save Notes</WoodButton>
        </ParchmentPanel>
      )}
    </div>
  );
}

