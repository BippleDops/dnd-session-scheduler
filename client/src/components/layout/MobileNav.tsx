'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const mainTabs = [
  { href: '/', icon: '⚔️', label: 'Quests', page: '' },
  { href: '/sessions', icon: '📜', label: 'Sessions', page: 'sessions' },
  { href: '/characters', icon: '🗡️', label: 'Heroes', page: 'characters' },
  { href: '/my-sessions', icon: '🎒', label: 'My Quests', page: 'my-sessions' },
];

const moreLinks = [
  { href: '/discussions', icon: '💬', label: 'Tavern Talk' },
  { href: '/recaps', icon: '📖', label: 'Recaps' },
  { href: '/stats', icon: '📊', label: 'My Stats' },
  { href: '/downtime', icon: '🏕️', label: 'Downtime' },
  { href: '/polls', icon: '📅', label: 'Polls' },
  { href: '/requests', icon: '🙋', label: 'Requests' },
  { href: '/homework', icon: '📝', label: 'Homework' },
  { href: '/messages', icon: '📨', label: 'Messages' },
  { href: '/gallery', icon: '🎨', label: 'Gallery' },
  { href: '/profile', icon: '👤', label: 'Profile' },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { isLoggedIn } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (page: string) => {
    if (page === '') return pathname === '/';
    return pathname.startsWith('/' + page);
  };

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-[1999] md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute bottom-16 left-0 right-0 bg-[var(--wood-dark)] border-t border-[var(--gold)] rounded-t-xl p-4 max-h-[60vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="grid grid-cols-3 gap-2">
              {moreLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.08)] no-underline transition-colors"
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="text-[10px] text-[var(--parchment-dark)]">{link.label}</span>
                </Link>
              ))}
              {isLoggedIn && (
                <a href="/auth/logout" className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.08)] no-underline transition-colors">
                  <span className="text-xl">🚪</span>
                  <span className="text-[10px] text-red-400">Logout</span>
                </a>
              )}
              {!isLoggedIn && (
                <a href="/auth/google" className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.08)] no-underline transition-colors">
                  <span className="text-xl">🔑</span>
                  <span className="text-[10px] text-[var(--gold)]">Sign In</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[1998] md:hidden bg-[var(--wood-dark)] border-t border-[rgba(201,169,89,0.3)] safe-area-bottom">
        <div className="flex justify-around items-center h-14">
          {mainTabs.map(tab => {
            const active = isActive(tab.page);
            return (
              <Link
                key={tab.page}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full no-underline transition-colors ${
                  active ? 'text-[var(--gold)] mobile-nav-active' : 'text-[var(--parchment-dark)]'
                }`}
              >
                <span className={`text-lg transition-transform ${active ? 'scale-110' : ''}`}>{tab.icon}</span>
                <span className="text-[9px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full bg-transparent border-none cursor-pointer transition-colors ${
              moreOpen ? 'text-[var(--gold)]' : 'text-[var(--parchment-dark)]'
            }`}
          >
            <span className="text-lg">☰</span>
            <span className="text-[9px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
