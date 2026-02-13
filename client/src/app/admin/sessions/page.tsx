'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getAdminSessions, getAdminSessionDetail, createAdminSession, cancelAdminSession, completeAdminSession, markAttendance, cancelAdminRegistration, getCampaigns } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WaxSeal from '@/components/ui/WaxSeal';
import WoodButton from '@/components/ui/WoodButton';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function AdminSessionsPage() {
  return <Suspense><AdminSessionsInner /></Suspense>;
}

function AdminSessionsInner() {
  usePageTitle('Session Management');
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  const sessionIdParam = searchParams.get('sessionId');
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: campaigns } = useApi(getCampaigns);

  const [view, setView] = useState<'list' | 'create' | 'detail'>(action === 'create' ? 'create' : sessionIdParam ? 'detail' : 'list');
  const [detailId, setDetailId] = useState(sessionIdParam || '');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');

  const filters: Record<string, string> = {};
  if (filterStatus) filters.status = filterStatus;
  if (filterCampaign) filters.campaign = filterCampaign;
  const { data: sessions, refetch: refetchList } = useApi(() => getAdminSessions(Object.keys(filters).length ? filters : undefined), [filterStatus, filterCampaign]);
  const { data: detail, refetch: refetchDetail } = useApi(() => detailId ? getAdminSessionDetail(detailId) : Promise.resolve(null), [detailId]);

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formCampaign, setFormCampaign] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMax, setFormMax] = useState('6');
  const [formDuration, setFormDuration] = useState('4');
  const [formDifficulty, setFormDifficulty] = useState('');
  const [formTier, setFormTier] = useState('any');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const dayType = formDate ? (() => { const d = new Date(formDate + 'T12:00:00'); return [0,6].includes(d.getDay()) ? 'Weekend' : 'Weeknight'; })() : '';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await confirm({ title: 'Create Session?', message: `Create ${formCampaign} session on ${formDate}?`, confirmLabel: 'Create' });
    if (!ok) return;
    const r = await createAdminSession({ date: formDate, startTime: formTime, campaign: formCampaign, title: formTitle, description: formDesc, maxPlayers: parseInt(formMax), duration: parseInt(formDuration), difficulty: formDifficulty, levelTier: formTier, location: formLocation, dmNotes: formNotes });
    if (r.success) { toast('Session created!', 'success'); setDetailId(r.sessionId || ''); setView('detail'); }
    else toast(JSON.stringify(r.errors || r.message), 'error');
  };

  const showDetail = (id: string) => { setDetailId(id); setView('detail'); };

  return (
    <div>
      {view === 'list' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="scroll-heading text-3xl">⚔️ Session Management</h1>
            <WoodButton variant="primary" onClick={() => setView('create')}>+ Create Session</WoodButton>
          </div>
          <div className="flex gap-3 mb-4 flex-wrap">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="tavern-input max-w-[160px]">
              <option value="">All Statuses</option><option value="Scheduled">Scheduled</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option>
            </select>
            <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)} className="tavern-input max-w-[160px]">
              <option value="">All Campaigns</option>
              {(campaigns || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="parchment overflow-x-auto">
            <table className="w-full text-sm text-[var(--ink)]">
              <thead><tr className="border-b-2 border-[var(--parchment-dark)]">
                <th className="text-left p-2">Date</th><th className="text-left p-2">Time</th><th className="text-left p-2">Campaign</th><th className="text-left p-2">Title</th><th className="text-left p-2">Players</th><th className="text-left p-2">Status</th><th className="p-2"></th>
              </tr></thead>
              <tbody>
                {(sessions || []).map(s => (
                  <tr key={s.sessionId} className="border-b border-[rgba(0,0,0,0.05)] cursor-pointer hover:bg-[rgba(201,169,89,0.05)]" onClick={() => showDetail(s.sessionId)}>
                    <td className="p-2">{formatDate(s.date)}</td>
                    <td className="p-2">{formatTime(s.startTime)}</td>
                    <td className="p-2"><WaxSeal campaign={s.campaign} size={24} /></td>
                    <td className="p-2">{s.title}</td>
                    <td className="p-2">{s.registeredCount}/{s.maxPlayers}</td>
                    <td className="p-2"><span className="tier-shield">{s.status}</span></td>
                    <td className="p-2"><WoodButton variant="sm" onClick={e => { e.stopPropagation(); showDetail(s.sessionId); }}>View</WoodButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'create' && (
        <>
          <h1 className="scroll-heading text-3xl mb-6">📝 Create Session</h1>
          <form onSubmit={handleCreate}>
            <ParchmentPanel className="max-w-xl space-y-3">
              <div><label className="block text-sm font-semibold text-[var(--ink)] mb-1">Date *</label><input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="tavern-input" required />{dayType && <span className="text-xs text-[var(--ink-faded)]">{dayType}</span>}</div>
              <div><label className="block text-sm font-semibold text-[var(--ink)] mb-1">Start Time *</label>
                <select value={formTime} onChange={e => setFormTime(e.target.value)} className="tavern-input" required>
                  <option value="">— Select date first —</option>
                  {dayType === 'Weekend' ? <><option value="12:00">12:00 PM</option><option value="17:00">5:00 PM</option></> : dayType === 'Weeknight' ? <option value="18:00">6:00 PM</option> : null}
                </select></div>
              <div><label className="block text-sm font-semibold text-[var(--ink)] mb-1">Campaign *</label>
                <select value={formCampaign} onChange={e => setFormCampaign(e.target.value)} className="tavern-input" required>
                  <option value="">— Select —</option>{(campaigns||[]).map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="block text-sm font-semibold text-[var(--ink)] mb-1">Title</label><input value={formTitle} onChange={e => setFormTitle(e.target.value)} className="tavern-input" /></div>
              <div><label className="block text-sm font-semibold text-[var(--ink)] mb-1">Description</label><textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} className="tavern-input" rows={3} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold text-[var(--ink)] mb-1">Max Players</label><input type="number" value={formMax} onChange={e => setFormMax(e.target.value)} className="tavern-input" min={1} max={20} /></div>
                <div><label className="block text-sm font-semibold text-[var(--ink)] mb-1">Duration (hrs)</label><input type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)} className="tavern-input" min={1} max={12} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold text-[var(--ink)] mb-1">Difficulty</label>
                  <select value={formDifficulty} onChange={e => setFormDifficulty(e.target.value)} className="tavern-input">
                    <option value="">—</option><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option><option value="Deadly">Deadly</option>
                  </select></div>
                <div><label className="block text-sm font-semibold text-[var(--ink)] mb-1">Level Tier</label>
                  <select value={formTier} onChange={e => setFormTier(e.target.value)} className="tavern-input">
                    <option value="any">Any Level (1-20)</option><option value="tier1">Tier 1: Lv 1-4</option><option value="tier2">Tier 2: Lv 5-10</option><option value="tier3">Tier 3: Lv 11-16</option><option value="tier4">Tier 4: Lv 17-20</option>
                  </select></div>
              </div>
              <div><label className="block text-sm font-semibold text-[var(--ink)] mb-1">Location</label><input value={formLocation} onChange={e => setFormLocation(e.target.value)} className="tavern-input" /></div>
              <div><label className="block text-sm font-semibold text-[var(--ink)] mb-1">DM Notes</label><textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className="tavern-input" rows={3} /></div>
              <div className="flex gap-3"><WoodButton variant="primary" type="submit">Create Session</WoodButton><WoodButton onClick={() => setView('list')}>Cancel</WoodButton></div>
            </ParchmentPanel>
          </form>
        </>
      )}

      {view === 'detail' && detail && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="scroll-heading text-3xl">{detail.title || detail.campaign}</h1>
            <WoodButton onClick={() => { setView('list'); refetchList(); }}>← Back</WoodButton>
          </div>
          <ParchmentPanel>
            <div className="grid grid-cols-2 gap-2 text-sm text-[var(--ink)]">
              <div><strong>Date:</strong> {formatDate(detail.date)}</div>
              <div><strong>Time:</strong> {formatTime(detail.startTime)} — {formatTime(detail.endTime)}</div>
              <div><strong>Campaign:</strong> <WaxSeal campaign={detail.campaign} size={20} /> {detail.campaign}</div>
              <div><strong>Status:</strong> <span className="tier-shield">{detail.status}</span></div>
              <div><strong>Players:</strong> {detail.registeredCount} / {detail.maxPlayers}</div>
              {detail.dmNotes && <div className="col-span-2"><strong>DM Notes:</strong> {detail.dmNotes}</div>}
            </div>
          </ParchmentPanel>

          <h2 className="scroll-heading text-xl mb-3">Registrations</h2>
          <div className="parchment overflow-x-auto mb-4">
            <table className="w-full text-sm text-[var(--ink)]">
              <thead><tr className="border-b-2 border-[var(--parchment-dark)]"><th className="text-left p-2">Player</th><th className="text-left p-2">Character</th><th className="text-left p-2">Class</th><th className="p-2">Lv</th><th className="text-left p-2">Status</th><th className="p-2">Attended</th><th className="p-2"></th></tr></thead>
              <tbody>
                {(detail.registrations || []).map(r => (
                  <tr key={r.registrationId} className="border-b border-[rgba(0,0,0,0.05)]">
                    <td className="p-2">{r.playerName}</td>
                    <td className="p-2 font-semibold">{r.characterName}</td>
                    <td className="p-2">{r.characterClass}</td>
                    <td className="p-2 text-center">{r.characterLevel}</td>
                    <td className="p-2">{r.status}</td>
                    <td className="p-2 text-center"><input type="checkbox" checked={r.attendanceConfirmed} onChange={e => { markAttendance(r.registrationId, e.target.checked); toast('Updated', 'success'); }} className="accent-[var(--gold)]" /></td>
                    <td className="p-2">{r.status === 'Confirmed' && <WoodButton variant="sm" onClick={async () => { await cancelAdminRegistration(r.registrationId); toast('Cancelled', 'success'); refetchDetail(); }}>Cancel</WoodButton>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 flex-wrap">
            {detail.status === 'Scheduled' && <>
              <WoodButton variant="danger" onClick={async () => { const ok = await confirm({ title: 'Cancel Session?', message: 'This will cancel the session and notify all registered players.', confirmLabel: 'Cancel Session', variant: 'danger' }); if (!ok) return; await cancelAdminSession(detail.sessionId); toast('Cancelled', 'success'); setView('list'); refetchList(); }}>Cancel Session</WoodButton>
              <WoodButton variant="primary" onClick={async () => { const ok = await confirm({ title: 'Mark Completed?', message: 'This will mark the session as completed and create a history entry.', confirmLabel: 'Complete' }); if (!ok) return; await completeAdminSession(detail.sessionId); toast('Completed!', 'success'); refetchDetail(); }}>Mark Completed</WoodButton>
            </>}
            <WoodButton onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/signup?sessionId=${detail.sessionId}`); toast('Link copied!', 'success'); }}>Copy Sign-Up Link</WoodButton>
            <WoodButton href={`/session/live?sessionId=${detail.sessionId}`}>⚡ Live View</WoodButton>
            <WoodButton href={`/admin/prep?sessionId=${detail.sessionId}`}>🗺️ Prep</WoodButton>
            <WoodButton href={`/admin/recap-wizard?sessionId=${detail.sessionId}`}>📜 Recap</WoodButton>
          </div>
        </>
      )}
    </div>
  );
}

