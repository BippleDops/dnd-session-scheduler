'use client';

/** Parchment-themed skeleton for a quest card while data loads */
export function QuestCardSkeleton() {
  return (
    <div className="quest-card p-5 pt-6 animate-pulse" style={{ borderLeft: '4px solid rgba(201,169,89,0.3)' }}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <div className="h-5 w-40 bg-[var(--parchment-dark)] rounded mb-2" />
          <div className="h-3 w-56 bg-[var(--parchment-dark)] rounded opacity-60" />
        </div>
        <div className="w-9 h-9 rounded-full bg-[var(--parchment-dark)]" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full bg-[var(--parchment-dark)] rounded opacity-40" />
        <div className="h-3 w-3/4 bg-[var(--parchment-dark)] rounded opacity-40" />
      </div>
      <div className="mt-3 flex justify-between items-center">
        <div className="h-3 w-24 bg-[var(--parchment-dark)] rounded opacity-50" />
        <div className="h-8 w-20 bg-[var(--parchment-dark)] rounded" />
      </div>
    </div>
  );
}

/** Grid of skeleton cards for a session listing */
export function SessionGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: count }, (_, i) => <QuestCardSkeleton key={i} />)}
    </div>
  );
}

/** Skeleton for calendar month grid */
export function CalendarSkeleton() {
  return (
    <div className="parchment p-5 mb-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-8 w-20 bg-[var(--parchment-dark)] rounded" />
        <div className="h-6 w-32 bg-[var(--parchment-dark)] rounded" />
        <div className="h-8 w-20 bg-[var(--parchment-dark)] rounded" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={`h-${i}`} className="text-center py-1">
            <div className="h-3 w-8 mx-auto bg-[var(--parchment-dark)] rounded opacity-50" />
          </div>
        ))}
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="min-h-[60px] p-1 rounded bg-[rgba(0,0,0,0.03)]">
            <div className="h-3 w-4 bg-[var(--parchment-dark)] rounded opacity-30" />
          </div>
        ))}
      </div>
    </div>
  );
}
