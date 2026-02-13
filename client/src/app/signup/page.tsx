'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getSession, getCsrfToken, submitSignup, getMyCharacters, getCampaigns, type Session, type Character } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import CandleLoader from '@/components/ui/CandleLoader';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WaxSeal from '@/components/ui/WaxSeal';
import WoodButton from '@/components/ui/WoodButton';
import TierShield, { isLevelValidForTier, getTierRange } from '@/components/ui/TierShield';
import { useToast } from '@/components/ui/Toast';
import Confetti from '@/components/ui/Confetti';

const CLASSES = ['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard','Artificer','Blood Hunter','Other'];
const CLASS_ICONS: Record<string, string> = {
  Barbarian: '🪓', Bard: '🎵', Cleric: '✝️', Druid: '🌿', Fighter: '⚔️', Monk: '👊',
  Paladin: '🛡️', Ranger: '🏹', Rogue: '🗡️', Sorcerer: '✨', Warlock: '👁️', Wizard: '🧙',
  Artificer: '⚙️', 'Blood Hunter': '🩸', Other: '⚔️',
};
const RACES = ['Human','Elf','Half-Elf','Dwarf','Halfling','Gnome','Half-Orc','Tiefling','Dragonborn','Goliath','Aasimar','Genasi','Tabaxi','Kenku','Firbolg','Tortle','Warforged','Changeling','Kalashtar','Shifter','Harengon','Owlin','Other'];

export default function SignupPage() { return <Suspense><SignupInner /></Suspense>; }
function SignupInner() {
  usePageTitle('Sign Up');
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') || '';
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [csrf, setCsrf] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  // Form state
  const [charName, setCharName] = useState('');
  const [charClasses, setCharClasses] = useState<string[]>([]);
  const [charRace, setCharRace] = useState('');
  const [charRaceOther, setCharRaceOther] = useState('');
  const [charLevel, setCharLevel] = useState('');
  const [prefCampaign, setPrefCampaign] = useState('');
  const [accessibility, setAccessibility] = useState('');
  const [dmNotes, setDmNotes] = useState('');
  const [playedBefore, setPlayedBefore] = useState('');

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    Promise.all([
      getSession(sessionId),
      getCsrfToken(),
      isLoggedIn ? getMyCharacters() : Promise.resolve([]),
      getCampaigns(),
    ]).then(([s, c, chars, camps]) => {
      setSession(s);
      setCsrf(c.token);
      setCharacters(chars);
      setCampaigns(camps);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [sessionId, isLoggedIn]);

  const fillCharacter = (c: Character) => {
    setCharName(c.characterName);
    setCharLevel(String(c.characterLevel));
    setCharRace(RACES.includes(c.characterRace || '') ? c.characterRace || '' : 'Other');
    if (!RACES.includes(c.characterRace || '')) setCharRaceOther(c.characterRace || '');
    setCharClasses(c.characterClass.split(',').map(s => s.trim()));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const race = charRace === 'Other' ? charRaceOther : charRace;
    try {
      const result = await submitSignup({
        csrfToken: csrf, sessionId, characterName: charName,
        characterClass: charClasses.join(', '), characterLevel: parseInt(charLevel, 10),
        characterRace: race, preferredCampaign: prefCampaign,
        accessibilityNeeds: accessibility, dmNotes, playedBefore,
      });
      if (result.success) { setDone(true); setResultMsg(result.message || ''); }
      else { toast(result.message || 'Failed', 'error'); }
    } catch { toast('An error occurred', 'error'); }
    setSubmitting(false);
  };

  if (loading) return <CandleLoader text="Preparing the sign-up scroll..." />;
  if (!sessionId || !session) return (
    <ParchmentPanel className="text-center py-10">
      <h2 className="font-[var(--font-heading)] text-xl text-[var(--ink)]">Quest Not Found</h2>
      <p className="text-[var(--ink-faded)] mt-2">This quest scroll doesn&apos;t exist or has been removed.</p>
      <WoodButton variant="primary" href="/" className="mt-4">Back to Quest Board</WoodButton>
    </ParchmentPanel>
  );
  if (!isLoggedIn) return (
    <ParchmentPanel className="text-center py-10">
      <h2 className="font-[var(--font-heading)] text-xl text-[var(--ink)]">Sign In Required</h2>
      <p className="text-[var(--ink-faded)] mt-2">You must sign in with Google before joining a quest.</p>
      <WoodButton variant="primary" href="/auth/google" className="mt-4">Sign In with Google</WoodButton>
    </ParchmentPanel>
  );
  if (session.spotsRemaining <= 0) return (
    <ParchmentPanel className="text-center py-10">
      <h2 className="font-[var(--font-heading)] text-xl text-[var(--candle)]">Quest Full</h2>
      <p className="text-[var(--ink-faded)] mt-2">This adventuring party is at capacity.</p>
      <WoodButton variant="primary" href="/" className="mt-4">Find Another Quest</WoodButton>
    </ParchmentPanel>
  );
  if (done) return (
    <>
      <Confetti count={35} />
      <ParchmentPanel className="text-center py-10">
        <h2 className="font-[var(--font-heading)] text-xl text-green-700">🎉 You&apos;re Registered!</h2>
        <p className="text-[var(--ink)] mt-2">{resultMsg}</p>
        <div className="flex gap-3 justify-center mt-4">
          <WoodButton variant="primary" href="/">Quest Board</WoodButton>
          <WoodButton href="/my-sessions">My Quests</WoodButton>
        </div>
      </ParchmentPanel>
    </>
  );

  return (
    <div>
      {/* Session summary */}
      <ParchmentPanel>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-[var(--font-heading)] text-xl text-[var(--ink)]">{session.title || session.campaign}</h2>
            <p className="text-sm text-[var(--ink-faded)]">{formatDate(session.date)} &bull; {formatTime(session.startTime)} — {formatTime(session.endTime)}</p>
            {session.description && <p className="text-sm text-[var(--ink-faded)] italic mt-1">{session.description}</p>}
          </div>
          <WaxSeal campaign={session.campaign} size={44} />
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-sm text-[var(--ink-faded)]">{session.spotsRemaining} spot{session.spotsRemaining !== 1 ? 's' : ''} remaining</span>
          {session.levelTier && session.levelTier !== 'any' && <TierShield tier={session.levelTier} size="md" showName />}
        </div>
        {/* Tier restriction banner */}
        {session.levelTier && session.levelTier !== 'any' && (() => {
          const range = getTierRange(session.levelTier);
          return (
            <div className="mt-3 p-3 rounded bg-[rgba(0,0,0,0.05)] border border-[var(--parchment-dark)]">
              <p className="text-sm font-semibold text-[var(--ink)]">🛡️ Level Restriction</p>
              <p className="text-xs text-[var(--ink-faded)] mt-1">
                Your character must be <strong>level {range.min}–{range.max}</strong> to join this session.
                Characters outside this range cannot sign up.
              </p>
            </div>
          );
        })()}
      </ParchmentPanel>

      {/* Character picker */}
      {characters.length > 0 && (
        <ParchmentPanel>
          <p className="text-sm font-semibold text-[var(--ink)] mb-2">Quick Select a Character</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {characters.map((c, i) => {
              const isSelected = charName === c.characterName;
              const classIcon = CLASS_ICONS[c.characterClass.split(',')[0].trim()] || '⚔️';
              const tier = session.levelTier || 'any';
              const eligible = tier === 'any' || isLevelValidForTier(c.characterLevel, tier);
              return (
                <button key={i} onClick={() => eligible && fillCharacter(c)} disabled={!eligible}
                  className={`flex items-center gap-2 p-3 rounded-lg text-left transition-all border relative ${
                    !eligible
                      ? 'border-[var(--parchment-dark)] bg-[var(--parchment)] opacity-50 cursor-not-allowed'
                      : isSelected
                        ? 'border-[var(--gold)] bg-[rgba(201,169,89,0.15)] shadow-md'
                        : 'border-[var(--parchment-dark)] bg-[var(--parchment)] hover:border-[var(--gold)] hover:shadow-sm'
                  }`}
                >
                  <span className="text-2xl">{classIcon}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[var(--gold)]' : 'text-[var(--ink)]'}`}>{c.characterName}</p>
                    <p className="text-[10px] text-[var(--ink-faded)]">{c.characterClass} · Lv{c.characterLevel}</p>
                    {!eligible && (
                      <p className="text-[10px] text-red-500 font-semibold mt-0.5">
                        {c.characterLevel < getTierRange(tier).min ? 'Level too low' : 'Level too high'}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
            <button onClick={() => { setCharName(''); setCharLevel(session.levelTier && session.levelTier !== 'any' ? String(getTierRange(session.levelTier).min) : ''); setCharClasses([]); setCharRace(''); }}
              className="flex items-center gap-2 p-3 rounded-lg text-left border border-dashed border-[var(--parchment-dark)] bg-[var(--parchment)] hover:border-[var(--gold)] transition-colors">
              <span className="text-2xl opacity-40">➕</span>
              <p className="text-sm text-[var(--ink-faded)]">New Character</p>
            </button>
          </div>
        </ParchmentPanel>
      )}

      {/* Sign-up form */}
      <form onSubmit={handleSubmit}>
        <ParchmentPanel>
          <h3 className="font-[var(--font-heading)] text-lg text-[var(--ink)] mb-3">Your Character</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Character Name *</label>
              <input value={charName} onChange={e => setCharName(e.target.value)} className="tavern-input" required maxLength={50} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Class *</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                {CLASSES.map(c => (
                  <label key={c} className="flex items-center gap-1 text-sm text-[var(--ink)]">
                    <input type="checkbox" checked={charClasses.includes(c)} onChange={e => setCharClasses(e.target.checked ? [...charClasses, c] : charClasses.filter(x => x !== c))} className="accent-[var(--gold)]" />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Race *</label>
                <select value={charRace} onChange={e => setCharRace(e.target.value)} className="tavern-input" required>
                  <option value="">— Select —</option>
                  {RACES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {charRace === 'Other' && <input value={charRaceOther} onChange={e => setCharRaceOther(e.target.value)} className="tavern-input mt-1" placeholder="Specify" />}
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Level *</label>
                {(() => {
                  const tier = session.levelTier || 'any';
                  const range = getTierRange(tier);
                  const level = parseInt(charLevel, 10);
                  const valid = !charLevel || isNaN(level) || (level >= range.min && level <= range.max);
                  return (
                    <>
                      <input type="number" value={charLevel} onChange={e => setCharLevel(e.target.value)}
                        className={`tavern-input ${!valid ? '!border-red-500' : ''}`}
                        min={range.min} max={range.max} required
                        placeholder={tier !== 'any' ? `${range.min}–${range.max}` : '1–20'} />
                      {charLevel && !isNaN(level) && (
                        <p className={`text-xs mt-1 font-semibold ${valid ? 'text-green-600' : 'text-red-500'}`}>
                          {valid ? `✓ Level ${level} is eligible` : `✗ Level must be ${range.min}–${range.max} for this session`}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </ParchmentPanel>

        <ParchmentPanel>
          <h3 className="font-[var(--font-heading)] text-lg text-[var(--ink)] mb-3">For the DM <span className="text-xs text-[var(--ink-faded)]">(optional)</span></h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Preferred Campaign</label>
              <select value={prefCampaign} onChange={e => setPrefCampaign(e.target.value)} className="tavern-input">
                <option value="">No Preference</option>
                {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Accessibility Needs</label>
              <textarea value={accessibility} onChange={e => setAccessibility(e.target.value)} className="tavern-input" rows={2} maxLength={1000} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Anything the DM Should Know</label>
              <textarea value={dmNotes} onChange={e => setDmNotes(e.target.value)} className="tavern-input" rows={2} maxLength={1000} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Played with this group before?</label>
              <div className="flex gap-4">
                {['Yes', 'No', 'First Time'].map(v => (
                  <label key={v} className="flex items-center gap-1 text-sm text-[var(--ink)]">
                    <input type="radio" name="playedBefore" value={v} checked={playedBefore === v} onChange={() => setPlayedBefore(v)} className="accent-[var(--gold)]" />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </ParchmentPanel>

        <WoodButton variant="primary" type="submit" disabled={submitting} className="w-full py-3 text-lg">
          {submitting ? 'Rolling for initiative...' : '⚔️ Sign Up for This Quest'}
        </WoodButton>
      </form>
    </div>
  );
}

