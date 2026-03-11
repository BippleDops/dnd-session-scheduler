'use client';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  className?: string;
  pinned?: boolean;
  title?: string;
}

export default function ParchmentPanel({ children, className, pinned = false, title }: Props) {
  return (
    <div className={cn(pinned ? 'quest-card' : 'parchment', 'p-5 mb-4', className)}>
      {title && <h2 className="font-[var(--font-heading)] text-lg text-[var(--gold)] mb-3">{title}</h2>}
      {children}
    </div>
  );
}

