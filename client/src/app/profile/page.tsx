'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getMyProfile, updateMyProfile, getCampaigns, getMyEmailPreferences, updateMyEmailPreferences, type EmailPreferences } from '@/lib/api';
import CandleLoader from '@/components/ui/CandleLoader';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import { useToast } from '@/components/ui/Toast';

export default function ProfilePage() { return <Suspense><ProfileInner /></Suspense>; }
function ProfileInner() {
  usePageTitle('My Profile');
  const { isLoggedIn } = useAuth();
  const searchParams = useSearchParams();
  const needsCompletion = searchParams.get('complete') === '1';
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [prefCampaign, setPrefCampaign] = useState('');
  const [accessibility, setAccessibility] = useState('');
  const [dmNotes, setDmNotes] = useState('');
  const [playedBefore, setPlayedBefore] = useState('');
  const [characters, setCharacters] = useState<{characterName:string;characterClass:string;characterLevel:number;characterRace?:string}[]>([]);
  const [hasProfile, setHasProfile] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>({ reminders: 1, confirmations: 1, cancellations: 1, updates: 1, digest: 1, achievements: 1 });

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    Promise.all([getMyProfile(), getCampaigns(), getMyEmailPreferences()]).then(([p, c, ep]) => {
      setEmailPrefs(ep);
      setCampaigns(c);
      if (p) {
        setHasProfile(true); setName(p.name); setEmail(p.email);
        setPrefCampaign(p.preferredCampaign); setAccessibility(p.accessibilityNeeds);
        setDmNotes(p.dmNotes); setPlayedBefore(p.playedBefore);
        setCharacters(p.characters);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isLoggedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast('Name is required', 'error'); return; }
    if (!playedBefore) { toast('Please select played before status', 'error'); return; }
    const r = await updateMyProfile({ name, preferredCampaign: prefCampaign, accessibilityNeeds: accessibility, dmNotes, playedBefore });
    if (r.success) toast('Profile saved!', 'success');
    else toast(r.message || 'Failed', 'error');
  };

  if (!isLoggedIn) return (
    <ParchmentPanel className="text-center py-10">
      <h2 className="font-[var(--font-heading)] text-xl text-[var(--ink)]">Sign In to View Profile</h2>
      <WoodButton variant="primary" href="/auth/google" className="mt-4">Sign In</WoodButton>
    </ParchmentPanel>
  );
  if (loading) return <CandleLoader text="Reading your character sheet..." />;

  return (
    <div>
      <h1 className="scroll-heading text-3xl mb-6">👤 My Profile</h1>

      {needsCompletion && (
        <div className="bg-[rgba(255,157,46,0.15)] border border-[var(--candle)] rounded px-4 py-3 mb-4 text-sm text-[var(--parchment)]">
          ⚠️ Please complete your profile before signing up for quests. Fill in all required fields and click Save.
        </div>
      )}

      {!hasProfile ? (
        <ParchmentPanel className="text-center py-10">
          <p className="text-[var(--ink-faded)]">No profile found. <a href="/sessions" className="text-[var(--gold)] underline">Sign up for a quest</a> to create one.</p>
        </ParchmentPanel>
      ) : (
        <>
          <form onSubmit={handleSubmit}>
            <ParchmentPanel>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="tavern-input" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Email</label>
                  <input value={email} disabled className="tavern-input opacity-60" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Preferred Campaign</label>
                  <select value={prefCampaign} onChange={e => setPrefCampaign(e.target.value)} className="tavern-input">
                    <option value="">No Preference</option>
                    {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Played D&D before? *</label>
                  <div className="flex gap-4">
                    {['Yes', 'No', 'First Time'].map(v => (
                      <label key={v} className="flex items-center gap-1 text-sm text-[var(--ink)]">
                        <input type="radio" checked={playedBefore === v} onChange={() => setPlayedBefore(v)} className="accent-[var(--gold)]" />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Accessibility Needs</label>
                  <textarea value={accessibility} onChange={e => setAccessibility(e.target.value)} className="tavern-input" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Anything the DM Should Know</label>
                  <textarea value={dmNotes} onChange={e => setDmNotes(e.target.value)} className="tavern-input" rows={2} />
                </div>
                <WoodButton variant="primary" type="submit">Save Profile</WoodButton>
              </div>
            </ParchmentPanel>
          </form>

          <h2 className="scroll-heading text-xl mb-3 mt-6">My Characters</h2>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            {characters.map((c, i) => (
              <ParchmentPanel key={i}>
                <p className="font-[var(--font-heading)] text-[var(--gold)]">{c.characterName}</p>
                <p className="text-sm text-[var(--ink-faded)]">{c.characterClass} · Lv {c.characterLevel}</p>
              </ParchmentPanel>
            ))}
            {characters.length === 0 && <p className="text-[var(--ink-faded)] italic col-span-full">No characters yet. Sign up for a quest!</p>}
          </div>

          <h2 className="scroll-heading text-xl mb-3 mt-6">📧 Email Preferences</h2>
          <ParchmentPanel>
            <p className="text-sm text-[var(--ink-faded)] mb-4">Choose which emails you&apos;d like to receive. You can also unsubscribe from individual categories via the link in any email.</p>
            <div className="space-y-3 max-w-lg">
              {([
                { key: 'reminders', label: 'Session Reminders', desc: 'Reminder emails 2 days before your sessions' },
                { key: 'confirmations', label: 'Signup Confirmations', desc: 'Confirmation when you register for a session' },
                { key: 'cancellations', label: 'Cancellation Notices', desc: 'Notification when a session you registered for is cancelled' },
                { key: 'updates', label: 'Session Updates', desc: 'When date, time, or location changes for a session you joined' },
                { key: 'digest', label: 'Weekly Digest', desc: 'Sunday summary of upcoming sessions and recent activity' },
                { key: 'achievements', label: 'Achievement Unlocks', desc: 'Email when you earn a new achievement' },
              ] as const).map(cat => (
                <label key={cat.key} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!emailPrefs[cat.key]}
                    onChange={async (e) => {
                      const updated = { ...emailPrefs, [cat.key]: e.target.checked ? 1 : 0 };
                      setEmailPrefs(updated);
                      await updateMyEmailPreferences(updated);
                      toast(`${cat.label} ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
                    }}
                    className="accent-[var(--gold)] mt-1"
                  />
                  <div>
                    <span className="text-sm font-semibold text-[var(--ink)]">{cat.label}</span>
                    <p className="text-xs text-[var(--ink-faded)]">{cat.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </ParchmentPanel>
        </>
      )}
    </div>
  );
}

