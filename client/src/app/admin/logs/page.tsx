'use client';
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { getAdminLogs } from '@/lib/api';
import { formatTimestamp } from '@/lib/utils';
import CandleLoader from '@/components/ui/CandleLoader';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';

export default function AdminLogsPage() {
  const [page, setPage] = useState(1);
  const [actionType, setActionType] = useState('');
  const { data, loading } = useApi(() => getAdminLogs(page, actionType || undefined), [page, actionType]);

  if (loading) return <CandleLoader text="Unrolling the audit scroll..." />;

  return (
    <div>
      <h1 className="scroll-heading text-3xl mb-6">📋 Audit Log</h1>
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <select value={actionType} onChange={e => { setActionType(e.target.value); setPage(1); }} className="tavern-input max-w-[200px]">
          <option value="">All Actions</option>
          {['SESSION_CREATED','SESSION_UPDATED','SESSION_CANCELLED','SESSION_COMPLETED','REGISTRATION_CREATED','REGISTRATION_CANCELLED','ATTENDANCE_MARKED','REMINDER_DRAFTED','BACKUP_COMPLETED','CONFIG_UPDATED'].map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {data && <span className="text-sm text-[var(--parchment-dark)]">Page {data.page} of {data.totalPages} ({data.total} entries)</span>}
      </div>

      <ParchmentPanel className="overflow-x-auto">
        <table className="w-full text-sm text-[var(--ink)]">
          <thead><tr className="border-b-2 border-[var(--parchment-dark)]"><th className="text-left p-2">Time</th><th className="text-left p-2">Action</th><th className="text-left p-2">Details</th><th className="text-left p-2">By</th></tr></thead>
          <tbody>
            {(data?.logs || []).map(l => (
              <tr key={l.LogID} className="border-b border-[rgba(0,0,0,0.05)]">
                <td className="p-2 whitespace-nowrap text-xs">{formatTimestamp(l.Timestamp)}</td>
                <td className="p-2"><code className="text-xs bg-[var(--parchment-dark)] px-1 rounded">{l.ActionType}</code></td>
                <td className="p-2 text-xs">{l.Details}</td>
                <td className="p-2 text-xs">{l.TriggeredBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ParchmentPanel>

      <div className="flex justify-center gap-3 mt-4">
        {page > 1 && <WoodButton variant="sm" onClick={() => setPage(page - 1)}>← Prev</WoodButton>}
        <span className="text-sm text-[var(--parchment-dark)] py-1">{data?.page} / {data?.totalPages}</span>
        {data && page < data.totalPages && <WoodButton variant="sm" onClick={() => setPage(page + 1)}>Next →</WoodButton>}
      </div>
    </div>
  );
}

