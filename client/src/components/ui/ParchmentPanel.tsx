'use client';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  className?: string;
  pinned?: boolean;
}

export default function ParchmentPanel({ children, className, pinned = false }: Props) {
  return (
    <div className={cn(pinned ? 'quest-card' : 'parchment', 'p-5 mb-4', className)}>
      {children}
    </div>
  );
}

