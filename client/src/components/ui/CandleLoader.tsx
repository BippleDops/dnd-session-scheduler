'use client';

export default function CandleLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex items-end gap-3">
        <div className="w-2 h-8 bg-[var(--parchment-dark)] rounded-t-sm" />
        <div className="candle-flame" />
        <div className="w-2 h-8 bg-[var(--parchment-dark)] rounded-t-sm" />
      </div>
      <p className="text-[var(--gold)] font-[var(--font-heading)] text-lg animate-pulse">{text}</p>
    </div>
  );
}

