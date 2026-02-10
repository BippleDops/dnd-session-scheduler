'use client';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'primary' | 'danger' | 'sm';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  href?: string;
}

export default function WoodButton({ variant = 'default', href, className, children, ...props }: Props) {
  const base = cn(
    'wood-btn',
    variant === 'primary' && 'wood-btn-primary',
    variant === 'danger' && 'wood-btn-danger',
    variant === 'sm' && 'text-sm py-1 px-3',
    className,
  );

  if (href) {
    return <a href={href} className={base}>{children}</a>;
  }

  return <button className={base} {...props}>{children}</button>;
}

