'use client';
import { useState, useEffect } from 'react';

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-20 md:bottom-6 left-6 z-[1400] w-10 h-10 rounded-full bg-[var(--wood-medium)] border border-[var(--gold)] text-[var(--gold)] shadow-lg hover:bg-[var(--wood-light)] transition-colors flex items-center justify-center text-lg"
      aria-label="Scroll to top"
    >
      ↑
    </button>
  );
}
