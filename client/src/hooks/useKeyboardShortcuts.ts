'use client';
import { useEffect, useState } from 'react';

export function useKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;

      switch (e.key) {
        case '?':
          e.preventDefault();
          setShowHelp(prev => !prev);
          break;
        case 'n':
          window.location.href = '/sessions';
          break;
        case 'c':
          window.location.href = '/characters';
          break;
        case 'q':
          window.location.href = '/';
          break;
        case 'm':
          window.location.href = '/my-sessions';
          break;
        case 'Escape':
          setShowHelp(false);
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { showHelp, setShowHelp };
}

export const SHORTCUTS = [
  { key: '?', description: 'Show/hide this help' },
  { key: 'q', description: 'Quest Board' },
  { key: 'n', description: 'Sessions list' },
  { key: 'c', description: 'Characters' },
  { key: 'm', description: 'My Quests' },
  { key: 'Esc', description: 'Close dialogs' },
];
