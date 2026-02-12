'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import NotificationBell from './NotificationBell';

const publicLinks = [
  { href: '/', label: '⚔️ Quest Board', page: '' },
  { href: '/sessions', label: '📜 Sessions', page: 'sessions' },
  { href: '/characters', label: '🗡️ Characters', page: 'characters' },
  { href: '/my-sessions', label: '🎒 My Quests', page: 'my-sessions' },
  { href: '/discussions', label: '💬 Tavern Talk', page: 'discussions' },
  { href: '/recaps', label: '📖 Recaps', page: 'recaps' },
];

const adminLinks = [
  { href: '/admin', label: 'Dashboard', page: 'admin' },
  { href: '/admin/sessions', label: 'Manage', page: 'admin/sessions' },
  { href: '/admin/downtime', label: 'Downtime', page: 'admin/downtime' },
  { href: '/admin/players', label: 'Players', page: 'admin/players' },
  { href: '/admin/analytics', label: 'Analytics', page: 'admin/analytics' },
  { href: '/admin/config', label: 'Config', page: 'admin/config' },
];

export default function TavernNav() {
  const pathname = usePathname();
  const { user, isAdmin, isLoggedIn } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [dungeonMode, setDungeonMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dungeonMode');
      if (saved === 'true') {
        document.documentElement.setAttribute('data-theme', 'dungeon');
        return true;
      }
    }
    return false;
  });

  const isActive = (page: string) => {
    if (page === '') return pathname === '/';
    return pathname.startsWith('/' + page);
  };

  const toggleDungeon = () => {
    const next = !dungeonMode;
    setDungeonMode(next);
    localStorage.setItem('dungeonMode', String(next));
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
            onClick={() => setMenuOpen(false)}
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
                onClick={() => setMenuOpen(false)}
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
      <div className="flex items-center gap-2">
        {isLoggedIn && <NotificationBell />}
        {isLoggedIn ? (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 bg-transparent border-none cursor-pointer py-1 px-2 rounded hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              aria-label="User menu"
            >
              {user?.photo ? (
                <img src={user.photo} alt="" className="w-7 h-7 rounded-full border border-[var(--gold)]" referrerPolicy="no-referrer" />
              ) : (
                <span className="w-7 h-7 rounded-full bg-[var(--wood-light)] flex items-center justify-center text-sm">👤</span>
              )}
              <span className="text-[var(--parchment-dark)] text-xs hidden sm:inline max-w-[80px] truncate">{user?.name?.split(' ')[0] || 'Menu'}</span>
              <span className="text-[var(--parchment-dark)] text-[10px]">▾</span>
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--wood-medium)] border border-[var(--gold)] rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                <div className="px-3 py-2 border-b border-[rgba(201,169,89,0.2)]">
                  <p className="text-sm font-semibold text-[var(--gold)] truncate">{user?.name}</p>
                  <p className="text-[10px] text-[var(--ink-faded)] truncate">{user?.email}</p>
                </div>
                {[
                  { href: '/profile', label: '👤 Profile' },
                  { href: '/stats', label: '📊 My Stats' },
                  { href: '/characters', label: '🗡️ Characters' },
                  { href: '/my-sessions', label: '🎒 My Quests' },
                ].map(item => (
                  <Link key={item.href} href={item.href} onClick={() => setUserMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-[var(--parchment)] hover:bg-[rgba(255,255,255,0.08)] no-underline transition-colors">
                    {item.label}
                  </Link>
                ))}
                <div className="border-t border-[rgba(201,169,89,0.2)] mt-1">
                  <a href="/auth/logout" className="block px-3 py-2 text-sm text-red-400 hover:bg-[rgba(255,255,255,0.08)] no-underline transition-colors">
                    🚪 Logout
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <a href="/auth/google" className="wood-btn wood-btn-primary text-xs py-1 px-3 no-underline">Sign In</a>
        )}
        <button onClick={toggleDungeon} className="text-lg cursor-pointer bg-transparent border-none" title="Toggle Dungeon Mode" aria-label={dungeonMode ? 'Switch to tavern mode' : 'Switch to dungeon mode'}>
          {dungeonMode ? '🕯️' : '🏰'}
        </button>
      </div>
    </nav>
  );
}

