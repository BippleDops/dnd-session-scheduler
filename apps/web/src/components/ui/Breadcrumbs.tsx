'use client';
import Link from 'next/link';

interface Crumb { label: string; href?: string }

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-[var(--ink-faded)] mb-4" aria-label="Breadcrumb">
      <Link href="/" className="hover:text-[var(--gold)] no-underline transition-colors">Home</Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="opacity-50">/</span>
          {item.href ? (
            <Link href={item.href} className="hover:text-[var(--gold)] no-underline transition-colors">{item.label}</Link>
          ) : (
            <span className="text-[var(--parchment)]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
