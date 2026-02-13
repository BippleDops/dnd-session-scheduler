'use client';
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getAdminPlayers, getAdminPlayerHistory, setPlayerStatus } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import CandleLoader from '@/components/ui/CandleLoader';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import { useToast } from '@/components/ui/Toast';

export default function AdminPlayersPage() {
  usePageTitle('Manage Players');
  const [status, setStatus] = useState('Active');
  const [search, setSearch] = useState('');
  const { data: players, loading, refetch } = useApi(() => getAdminPlayers(status), [status]);
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<{characterName:string;characterClass:string;characterLevel:number;status:string;sessionDate:string;campaign:string}[]>([]);

  const filtered = (players || []).filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.Name.toLowerCase().includes(q) || p.Email.toLowerCase().includes(q) ||
      p.characters.some(c => c.name.toLowerCase().includes(q));
  });

  const showPlayer = async (id: string) => {
    setSelectedId(id);
    const h = await getAdminPlayerHistory(id);
    setHistory(h);
  };

  const player = filtered.find(p => p.PlayerID === selectedId);

  if (loading) return <CandleLoader text="Opening the guild roster..." />;

  return (
    <div>
      <h1 className="scroll-heading text-3xl mb-6">👥 Adventurer Guild Roster</h1>
      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search adventurers..." className="tavern-input max-w-xs" />
        <select value={status} onChange={e => setStatus(e.target.value)} className="tavern-input max-w-[140px]">
          <option value="">All</option><option value="Active">Active</option><option value="Inactive">Inactive</option>
        </select>
        <WoodButton variant="sm" onClick={() => window.location.href = '/api/admin/export/players'}>Export CSV</WoodButton>
      </div>

      <div className="parchment overflow-x-auto mb-4">
        <table className="w-full text-sm text-[var(--ink)]">
          <thead><tr className="border-b-2 border-[var(--parchment-dark)]">
            <th className="text-left p-2 cursor-pointer">Name</th><th className="text-left p-2">Email</th><th className="text-left p-2">Characters</th><th className="p-2">Registered</th><th className="p-2">Status</th>
          </tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.PlayerID} className="border-b border-[rgba(0,0,0,0.05)] cursor-pointer hover:bg-[rgba(201,169,89,0.05)]" onClick={() => showPlayer(p.PlayerID)}>
                <td className="p-2 font-semibold">{p.Name}</td>
                <td className="p-2 text-xs">{p.Email}</td>
                <td className="p-2">{p.characters.map((c, i) => (
                  <span key={i} className="inline-block bg-[var(--parchment-dark)] text-[var(--ink)] text-xs px-2 py-0.5 rounded mr-1 mb-1">{c.name} ({c.class} Lv{c.level})</span>
                ))}</td>
                <td className="p-2 text-center">{p.totalRegistrations}{p.sessionsAttended ? ` (${p.sessionsAttended} attended)` : ''}</td>
                <td className="p-2 text-center"><span className={`tier-shield ${p.ActiveStatus === 'Active' ? '' : '!bg-red-900'}`}>{p.ActiveStatus}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {player && (
        <ParchmentPanel>
          <h3 className="font-[var(--font-heading)] text-lg text-[var(--gold)] mb-3">{player.Name}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-[var(--ink)] mb-3">
            <div><strong>Email:</strong> {player.Email}</div>
            <div><strong>Preferred Campaign:</strong> {player.PreferredCampaign || '—'}</div>
            <div><strong>Sessions Attended:</strong> {player.sessionsAttended}</div>
            <div><strong>Total Sign-ups:</strong> {player.totalRegistrations}</div>
          </div>
          <WoodButton variant={player.ActiveStatus === 'Active' ? 'danger' : 'primary'} onClick={async () => {
            const newStatus = player.ActiveStatus === 'Active' ? 'Inactive' : 'Active';
            await setPlayerStatus(player.PlayerID, newStatus);
            toast(`Player set to ${newStatus}`, 'success'); refetch();
          }}>{player.ActiveStatus === 'Active' ? 'Deactivate' : 'Activate'}</WoodButton>

          <h4 className="font-semibold text-[var(--ink)] mt-4 mb-2">Session History</h4>
          {history.length === 0 ? <p className="text-[var(--ink-faded)] italic text-sm">No history.</p> : (
            <table className="w-full text-sm text-[var(--ink)]">
              <thead><tr className="border-b"><th className="text-left p-1">Date</th><th className="text-left p-1">Campaign</th><th className="text-left p-1">Character</th><th className="p-1">Status</th></tr></thead>
              <tbody>{history.map((h, i) => (
                <tr key={i} className="border-b border-[rgba(0,0,0,0.05)]"><td className="p-1">{formatDate(h.sessionDate)}</td><td className="p-1">{h.campaign}</td><td className="p-1">{h.characterName}</td><td className="p-1">{h.status}</td></tr>
              ))}</tbody>
            </table>
          )}
        </ParchmentPanel>
      )}
    </div>
  );
}

