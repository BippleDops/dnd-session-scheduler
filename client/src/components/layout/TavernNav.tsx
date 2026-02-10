'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import NotificationBell from './NotificationBell';

const publicLinks = [
  { href: '/', label: '⚔️ Quest Board', page: '' },
  { href: '/sessions', label: '📜 Sessions', page: 'sessions' },
  { href: '/my-sessions', label: '🎒 My Quests', page: 'my-sessions' },
  { href: '/profile', label: '👤 Profile', page: 'profile' },
  { href: '/recaps', label: '📖 Recaps', page: 'recaps' },
];

const adminLinks = [
  { href: '/admin', label: 'Dashboard', page: 'admin' },
  { href: '/admin/sessions', label: 'Manage', page: 'admin/sessions' },
  { href: '/admin/players', label: 'Players', page: 'admin/players' },
  { href: '/admin/history', label: 'History', page: 'admin/history' },
  { href: '/admin/config', label: 'Config', page: 'admin/config' },
];

export default function TavernNav() {
  const pathname = usePathname();
  const { user, isAdmin, isLoggedIn } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dungeonMode, setDungeonMode] = useState(false);

  const isActive = (page: string) => {
    if (page === '') return pathname === '/';
    return pathname.startsWith('/' + page);
  };

  const toggleDungeon = () => {
    const next = !dungeonMode;
    setDungeonMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dungeon' : '');
  };

  return (
    <nav className="tavern-nav px-5 py-0 flex items-center justify-between flex-wrap min-h-[56px]">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2 py-3 no-underline">
        <span className="text-2xl">🎲</span>
        <span className="font-[var(--font-heading)] text-[var(--gold)] text-lg tracking-wide">
          D&D Session Scheduler
        </span>
      </Link>

      {/* Hamburger */}
      <button
        className="md:hidden text-[var(--gold)] text-2xl bg-transparent border-none cursor-pointer"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Menu"
      >
        ☰
      </button>

      {/* Links */}
      <div className={`${menuOpen ? 'flex' : 'hidden'} md:flex flex-wrap gap-1 items-center w-full md:w-auto`}>
        {publicLinks.map(link => (
          <Link
            key={link.page}
            href={link.href}
            className={`px-3 py-2 rounded text-sm no-underline transition-colors ${
              isActive(link.page)
                ? 'bg-[rgba(201,169,89,0.2)] text-[var(--gold)]'
                : 'text-[var(--parchment-dark)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--parchment)]'
            }`}
          >
            {link.label}
          </Link>
        ))}

        {isAdmin && (
          <>
            <span className="w-px h-5 bg-[rgba(201,169,89,0.3)] mx-1 hidden md:block" />
            {adminLinks.map(link => (
              <Link
                key={link.page}
                href={link.href}
                className={`px-3 py-2 rounded text-sm no-underline transition-colors ${
                  isActive(link.page)
                    ? 'bg-[rgba(201,169,89,0.2)] text-[var(--gold)]'
                    : 'text-[var(--parchment-dark)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--parchment)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {isLoggedIn && <NotificationBell />}
        {isLoggedIn ? (
          <>
            <span className="text-[var(--parchment-dark)] text-xs hidden sm:inline">{user?.name || user?.email}</span>
            <a href="/auth/logout" className="wood-btn text-xs py-1 px-2 no-underline">Logout</a>
          </>
        ) : (
          <a href="/auth/google" className="wood-btn wood-btn-primary text-xs py-1 px-3 no-underline">Sign In</a>
        )}
        <button onClick={toggleDungeon} className="text-lg cursor-pointer bg-transparent border-none" title="Toggle Dungeon Mode">
          {dungeonMode ? '🕯️' : '🏰'}
        </button>
      </div>
    </nav>
  );
}

