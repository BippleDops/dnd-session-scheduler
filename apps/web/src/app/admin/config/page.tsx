'use client';
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getAdminConfig, saveAdminConfig, previewPurge, executePurge } from '@/lib/api';
import CandleLoader from '@/components/ui/CandleLoader';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import { useToast } from '@/components/ui/Toast';

export default function AdminConfigPage() {
  usePageTitle('Configuration');
  const { data: config, loading } = useApi(getAdminConfig);
  const { toast } = useToast();

  const [purgeDate, setPurgeDate] = useState('');
  const [purgePreview, setPurgePreview] = useState<{ sessions: number; registrations: number } | null>(null);
  const [purging, setPurging] = useState(false);

  const handlePreview = async () => {
    if (!purgeDate) { toast('Select a cutoff date', 'error'); return; }
    const result = await previewPurge(purgeDate);
    if (result.error) { toast(result.error, 'error'); return; }
    setPurgePreview(result);
  };

  const handlePurge = async () => {
    if (!purgeDate || !purgePreview) return;
    setPurging(true);
    const result = await executePurge(purgeDate);
    setPurging(false);
    if (result.success) {
      toast(`Purged ${result.sessionsDeleted} sessions and ${result.registrationsDeleted} registrations`, 'success');
      setPurgePreview(null);
      setPurgeDate('');
    } else {
      toast(result.error || 'Purge failed', 'error');
    }
  };

  if (loading) return <CandleLoader text="Reading the arcane scrolls..." />;

  return (
    <div>
      <h1 className="scroll-heading text-3xl mb-6">⚙️ Configuration</h1>
      <ParchmentPanel>
        <table className="w-full text-sm text-[var(--ink)]">
          <thead><tr className="border-b-2 border-[var(--parchment-dark)]"><th className="text-left p-2">Key</th><th className="text-left p-2">Value</th><th className="text-left p-2">Description</th><th className="p-2"></th></tr></thead>
          <tbody>
            {(config || []).map((c, idx) => (
              <tr key={c.key} className="border-b border-[rgba(0,0,0,0.05)]">
                <td className="p-2"><code className="bg-[var(--parchment-dark)] px-1 rounded text-xs">{c.key}</code></td>
                <td className="p-2"><input defaultValue={c.value} id={`cfg-${idx}`} className="tavern-input text-sm" /></td>
                <td className="p-2 text-xs text-[var(--ink-faded)]">{c.description}</td>
                <td className="p-2"><WoodButton variant="sm" onClick={async () => {
                  const val = (document.getElementById(`cfg-${idx}`) as HTMLInputElement).value;
                  await saveAdminConfig(c.key, val);
                  toast(`${c.key} saved`, 'success');
                }}>Save</WoodButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ParchmentPanel>

      <h2 className="scroll-heading text-xl mb-3 mt-8">Data Maintenance</h2>
      <ParchmentPanel>
        <h3 className="font-semibold text-[var(--ink)] mb-2">Purge Old Sessions</h3>
        <p className="text-sm text-[var(--ink-faded)] mb-3">
          Delete completed/cancelled sessions and all associated data (registrations, history, prep notes, moments, loot, dice rolls) before a cutoff date.
        </p>
        <div className="flex items-end gap-3 mb-3">
          <div>
            <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Delete sessions before</label>
            <input type="date" value={purgeDate} onChange={e => { setPurgeDate(e.target.value); setPurgePreview(null); }} className="tavern-input" />
          </div>
          <WoodButton variant="sm" onClick={handlePreview}>Preview</WoodButton>
        </div>
        {purgePreview && (
          <div className="bg-[rgba(139,0,0,0.08)] border border-red-300 rounded px-4 py-3 mb-3">
            <p className="text-sm text-[var(--ink)]">
              This will permanently delete <strong>{purgePreview.sessions} session{purgePreview.sessions !== 1 ? 's' : ''}</strong> and <strong>{purgePreview.registrations} registration{purgePreview.registrations !== 1 ? 's' : ''}</strong>, plus all related data.
            </p>
            {purgePreview.sessions > 0 ? (
              <WoodButton variant="sm" onClick={handlePurge} disabled={purging} className="mt-2 !bg-red-800 hover:!bg-red-700">
                {purging ? 'Purging...' : 'Confirm Purge'}
              </WoodButton>
            ) : (
              <p className="text-sm text-[var(--ink-faded)] mt-1">Nothing to purge.</p>
            )}
          </div>
        )}
      </ParchmentPanel>
    </div>
  );
}
