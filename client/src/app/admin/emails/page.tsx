'use client';
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getAdminEmails, sendTestEmail } from '@/lib/api';
import { formatTimestamp } from '@/lib/utils';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';
import { useToast } from '@/components/ui/Toast';

const STATUS_COLORS: Record<string, string> = {
  OK: 'text-green-400', Sent: 'text-green-400', Draft: 'text-yellow-400', Failed: 'text-red-400',
};

export default function AdminEmailsPage() {
  usePageTitle('Email Log');
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const { data, loading } = useApi(() => getAdminEmails(page, filterStatus || undefined, filterType || undefined), [page, filterStatus, filterType]);

  if (!isAdmin) return <ParchmentPanel title="Access Denied"><p>Admin only.</p></ParchmentPanel>;
  if (loading) return <CandleLoader text="Loading email log..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">📧 Email Log</h1>
        <WoodButton variant="sm" onClick={async () => { const r = await sendTestEmail(); toast(r.message || (r.success ? 'Sent!' : 'Failed'), r.success ? 'success' : 'error'); }}>📤 Send Test Email</WoodButton>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="tavern-input max-w-[140px]">
          <option value="">All Status</option>
          <option value="OK">Sent</option>
          <option value="Draft">Draft</option>
          <option value="Failed">Failed</option>
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="tavern-input max-w-[140px]">
          <option value="">All Types</option>
          <option value="Sent">Sent</option>
          <option value="Draft">Draft</option>
          <option value="Failed">Failed</option>
        </select>
        {data && <span className="text-sm text-[var(--parchment-dark)]">{data.total} emails · Page {data.page}/{data.totalPages}</span>}
      </div>

      <ParchmentPanel className="overflow-x-auto">
        <table className="w-full text-sm text-[var(--ink)]">
          <thead>
            <tr className="border-b-2 border-[var(--parchment-dark)]">
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Recipient</th>
              <th className="text-left p-2">Subject</th>
              <th className="text-left p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.emails || []).length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-[var(--ink-faded)] italic">No emails found.</td></tr>
            ) : data?.emails.map(e => (
              <tr key={e.log_id} className="border-b border-[rgba(0,0,0,0.05)]">
                <td className="p-2 text-xs whitespace-nowrap">{formatTimestamp(e.timestamp)}</td>
                <td className="p-2"><code className="text-xs bg-[var(--parchment-dark)] px-1 rounded">{e.type}</code></td>
                <td className="p-2 text-xs">{e.recipient}</td>
                <td className="p-2 text-xs truncate max-w-[200px]">{e.subject}</td>
                <td className="p-2"><span className={`text-xs font-bold ${STATUS_COLORS[e.status] || ''}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ParchmentPanel>

      <div className="flex justify-center gap-3">
        {page > 1 && <WoodButton variant="sm" onClick={() => setPage(page - 1)}>← Prev</WoodButton>}
        <span className="text-sm text-[var(--parchment-dark)] py-1">{data?.page} / {data?.totalPages}</span>
        {data && page < data.totalPages && <WoodButton variant="sm" onClick={() => setPage(page + 1)}>Next →</WoodButton>}
      </div>
    </div>
  );
}
