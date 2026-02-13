'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import { useToast } from '@/components/ui/Toast';

interface DMInsight { type: string; icon: string; message: string; priority: string }
interface NPC { name: string; role: string; roleDescription: string; personality: string; quirk: string; voiceNote: string }
interface PreviouslyOn { date: string; characters: string; summary: string }
interface EngagementScore { player_id: string; name: string; attendance_score: number; journal_score: number; downtime_score: number; discussion_score: number; overall_score: number }

const BASE = process.env.NEXT_PUBLIC_API_URL || '';
async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, { credentials: 'include', ...opts, headers: { 'Content-Type': 'application/json', ...opts?.headers } });
  return res.json();
}

export default function DMToolsPage() {
  usePageTitle('DM Tools');
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [insights, setInsights] = useState<DMInsight[]>([]);
  const [npc, setNpc] = useState<NPC | null>(null);
  const [npcRole, setNpcRole] = useState('neutral');
  const [previouslyOn, setPreviouslyOn] = useState<PreviouslyOn | null>(null);
  const [prevCampaign, setPrevCampaign] = useState('');
  const [scores, setScores] = useState<EngagementScore[]>([]);
  const [tab, setTab] = useState<'insights' | 'generators' | 'engagement'>('insights');

  const loadInsights = async () => { setInsights(await fetchJson<DMInsight[]>('/api/admin/insights')); };
  const generateNPC = async () => { setNpc(await fetchJson<NPC>(`/api/admin/generate-npc?role=${npcRole}`)); };
  const loadPreviouslyOn = async () => { if (prevCampaign) setPreviouslyOn(await fetchJson<PreviouslyOn>(`/api/admin/previously-on/${encodeURIComponent(prevCampaign)}`)); };
  const loadScores = async () => {
    await fetchJson('/api/admin/engagement-refresh', { method: 'POST' });
    setScores(await fetchJson<EngagementScore[]>('/api/admin/engagement-scores'));
  };

  if (!isAdmin) return <ParchmentPanel title="Access Denied"><p>Admin only.</p></ParchmentPanel>;

  const PRIORITY_COLORS: Record<string, string> = { high: 'border-red-500', medium: 'border-yellow-500', low: 'border-[var(--gold)]' };

  return (
    <div className="space-y-6">
      <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">🔮 DM Tools & Insights</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {([['insights', '🧠 Insights'], ['generators', '⚡ Generators'], ['engagement', '📊 Engagement']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded text-sm font-[var(--font-heading)] whitespace-nowrap transition-colors ${tab === key ? 'bg-[var(--gold)] text-[var(--wood-dark)]' : 'bg-[var(--wood-dark)] text-[var(--parchment-dark)] hover:bg-[var(--wood-light)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'insights' && (
        <div className="space-y-4">
          <WoodButton onClick={loadInsights}>🧠 Load DM Insights</WoodButton>
          {insights.length > 0 && (
            <div className="space-y-2">
              {insights.map((ins, i) => (
                <ParchmentPanel key={i} className={`border-l-4 ${PRIORITY_COLORS[ins.priority] || ''}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{ins.icon}</span>
                    <div>
                      <p className="text-sm text-[var(--ink)]">{ins.message}</p>
                      <span className="text-[10px] text-[var(--ink-faded)] uppercase">{ins.priority} priority</span>
                    </div>
                  </div>
                </ParchmentPanel>
              ))}
            </div>
          )}
          {insights.length === 0 && <p className="text-[var(--ink-faded)] italic text-sm">Click above to analyze your campaigns.</p>}
        </div>
      )}

      {tab === 'generators' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* NPC Generator */}
          <ParchmentPanel title="🎭 NPC Generator">
            <div className="flex gap-2 mb-3">
              <select className="tavern-input flex-1" value={npcRole} onChange={e => setNpcRole(e.target.value)}>
                <option value="neutral">Any Role</option>
                <option value="merchant">Merchant</option>
                <option value="villain">Villain</option>
                <option value="guide">Guide</option>
                <option value="quest_giver">Quest Giver</option>
                <option value="ally">Ally</option>
              </select>
              <WoodButton onClick={generateNPC}>Generate</WoodButton>
            </div>
            {npc && (
              <div className="space-y-2 card-enter">
                <h3 className="font-[var(--font-heading)] text-lg text-[var(--gold)]">{npc.name}</h3>
                <p className="text-xs text-[var(--ink-faded)] uppercase">{npc.role} — {npc.roleDescription}</p>
                <div className="space-y-1 text-sm">
                  <p><strong>Personality:</strong> {npc.personality}</p>
                  <p><strong>Quirk:</strong> {npc.quirk}</p>
                  <p><strong>Voice:</strong> {npc.voiceNote}</p>
                </div>
                <WoodButton variant="sm" onClick={generateNPC}>🔄 Reroll</WoodButton>
              </div>
            )}
          </ParchmentPanel>

          {/* Previously On */}
          <ParchmentPanel title='📖 "Previously On..."'>
            <div className="flex gap-2 mb-3">
              <input className="tavern-input flex-1" placeholder="Campaign name" value={prevCampaign} onChange={e => setPrevCampaign(e.target.value)} />
              <WoodButton onClick={loadPreviouslyOn}>Generate</WoodButton>
            </div>
            {previouslyOn && (
              <div className="card-enter">
                <p className="text-xs text-[var(--ink-faded)] mb-2">{previouslyOn.date} · {previouslyOn.characters}</p>
                <div className="p-3 bg-[rgba(0,0,0,0.03)] rounded italic text-sm leading-relaxed">
                  {previouslyOn.summary}
                </div>
              </div>
            )}
          </ParchmentPanel>
        </div>
      )}

      {tab === 'engagement' && (
        <div className="space-y-4">
          <WoodButton onClick={loadScores}>📊 Refresh Engagement Scores</WoodButton>
          {scores.length > 0 && (
            <ParchmentPanel>
              <table className="w-full text-sm text-[var(--ink)]">
                <thead><tr className="border-b-2 border-[var(--parchment-dark)]">
                  <th className="text-left p-2">#</th><th className="text-left p-2">Player</th>
                  <th className="text-center p-2">Attendance</th><th className="text-center p-2">Journals</th>
                  <th className="text-center p-2">Downtime</th><th className="text-center p-2">Discussion</th>
                  <th className="text-center p-2 font-bold">Overall</th>
                </tr></thead>
                <tbody>
                  {scores.map((s, i) => (
                    <tr key={s.player_id} className="border-b border-[rgba(0,0,0,0.05)]">
                      <td className="p-2 text-[var(--gold)] font-bold">{i + 1}</td>
                      <td className="p-2 font-semibold">{s.name}</td>
                      <td className="text-center p-2">{s.attendance_score}/40</td>
                      <td className="text-center p-2">{s.journal_score}/20</td>
                      <td className="text-center p-2">{s.downtime_score}/20</td>
                      <td className="text-center p-2">{s.discussion_score}/20</td>
                      <td className="text-center p-2 font-bold text-[var(--gold)]">{s.overall_score}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ParchmentPanel>
          )}
        </div>
      )}
    </div>
  );
}
