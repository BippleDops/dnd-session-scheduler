'use client';
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    if (typeof window !== 'undefined' && localStorage.getItem('installPromptDismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
    setDismissed(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[2000] bg-gradient-to-r from-[var(--wood-dark)] to-[var(--wood-medium)] border-b border-[var(--gold)] px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl flex-shrink-0">🎲</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--gold)] truncate">Install D&D Sessions</p>
          <p className="text-[10px] text-[var(--parchment-dark)]">Add to home screen for quick access</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={handleInstall} className="wood-btn wood-btn-primary text-xs py-1 px-3">Install</button>
        <button onClick={handleDismiss} className="text-[var(--parchment-dark)] hover:text-white text-lg bg-transparent border-none cursor-pointer" aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
