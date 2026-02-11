'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getPlayerPublicProfile, type PlayerPublicProfile } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import CandleLoader from '@/components/ui/CandleLoader';
import Link from 'next/link';

export default function PlayerProfilePage() { return <Suspense><PlayerProfileInner /></Suspense>; }
function PlayerProfileInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';
  const [profile, setProfile] = useState<PlayerPublicProfile | null>(null);

  useEffect(() => {
    if (id) getPlayerPublicProfile(id).then(setProfile);
  }, [id]);

  if (!profile) return <CandleLoader text="Loading profile..." />;

  return (
    <div className="space-y-6">
      <ParchmentPanel>
        <div className="flex items-center gap-4">
          {profile.photo_url ? (
            <img src={profile.photo_url} alt="" className="w-20 h-20 rounded-full border-2 border-[var(--gold)]" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[var(--wood-dark)] flex items-center justify-center text-3xl">👤</div>
          )}
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl text-[var(--gold)]">{profile.name}</h1>
            <p className="text-sm text-[var(--parchment-dark)]">{profile.session_count} sessions across {profile.campaigns.length} campaigns</p>
          </div>
        </div>
      </ParchmentPanel>

      {/* Achievements */}
      {profile.achievements.length > 0 && (
        <ParchmentPanel title="🏆 Achievements">
          <div className="flex flex-wrap gap-2">
            {profile.achievements.map(a => (
              <div key={a.achievement_id} className="flex items-center gap-1 bg-[var(--wood-dark)] px-3 py-1.5 rounded text-sm" title={a.description}>
                <span>{a.icon}</span>
                <span className="text-[var(--gold)]">{a.name}</span>
              </div>
            ))}
          </div>
        </ParchmentPanel>
      )}

      {/* Characters */}
      <ParchmentPanel title={`⚔️ Characters (${profile.characters.length})`}>
        {profile.characters.length === 0 ? (
          <p className="text-[var(--ink-faded)] text-center">No active characters.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profile.characters.map(c => (
              <Link key={c.character_id} href={`/character?id=${c.character_id}`} className="block p-3 bg-[var(--wood-dark)] rounded hover:bg-[var(--wood-light)] transition-colors">
                <div className="flex items-center gap-2">
                  {c.portrait_url ? (
                    <img src={c.portrait_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[var(--wood)] flex items-center justify-center">⚔️</div>
                  )}
                  <div>
                    <span className="font-bold text-[var(--gold)]">{c.name}</span>
                    <p className="text-xs text-[var(--parchment-dark)]">Level {c.level} {c.race} {c.class}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </ParchmentPanel>

      {/* Campaigns */}
      <ParchmentPanel title="🗺️ Campaigns">
        <div className="flex flex-wrap gap-2">
          {profile.campaigns.map(c => (
            <Link key={c} href={`/campaign?slug=${c.toLowerCase().replace(/\s+/g, '-')}`}
              className="px-3 py-1.5 bg-[var(--wood-dark)] rounded text-sm hover:bg-[var(--gold)] hover:text-[var(--wood-dark)] transition-colors">
              {c}
            </Link>
          ))}
        </div>
      </ParchmentPanel>
    </div>
  );
}
