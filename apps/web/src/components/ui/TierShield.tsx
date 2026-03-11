'use client';
import { theme, type TierKey } from '@/lib/theme';

interface Props {
  tier: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export default function TierShield({ tier, size = 'sm', showName = false }: Props) {
  const key = (tier || 'any') as TierKey;
  const info = theme.tiers[key] || theme.tiers.any;
  if (key === 'any') return null;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-4 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-[var(--font-ui)] font-semibold ${sizeClasses[size]}`}
      style={{ backgroundColor: `${info.color}20`, color: info.color, border: `1px solid ${info.color}40` }}
      title={info.name}
    >
      🛡️ {info.label}: Lv {info.range}
      {showName && <span className="opacity-70 ml-1">({info.name})</span>}
    </span>
  );
}

/** Check if a character level is valid for a tier */
export function isLevelValidForTier(level: number, tier: string): boolean {
  const key = (tier || 'any') as TierKey;
  const info = theme.tiers[key] || theme.tiers.any;
  return level >= info.min && level <= info.max;
}

/** Get the min/max level range for a tier */
export function getTierRange(tier: string): { min: number; max: number } {
  const key = (tier || 'any') as TierKey;
  const info = theme.tiers[key] || theme.tiers.any;
  return { min: info.min, max: info.max };
}
