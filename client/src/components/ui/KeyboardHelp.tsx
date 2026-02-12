'use client';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardHelp({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative parchment p-6 w-80 rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-[var(--font-heading)] text-lg text-[var(--ink)]">⌨️ Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-[var(--ink-faded)] hover:text-[var(--ink)] text-lg bg-transparent border-none cursor-pointer">✕</button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex justify-between items-center">
              <span className="text-sm text-[var(--ink)]">{s.description}</span>
              <kbd className="px-2 py-0.5 bg-[var(--parchment-dark)] text-[var(--ink)] text-xs rounded border border-[var(--ink-faded)] font-mono">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--ink-faded)] mt-4 text-center">Press <kbd className="font-mono">?</kbd> to toggle this help</p>
      </div>
    </div>
  );
}
