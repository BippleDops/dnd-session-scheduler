'use client';
import { theme, type TierKey } from '@/lib/theme';

export default function TierShield({ tier }: { tier: string }) {
  const key = (tier || 'any') as TierKey;
  const info = theme.tiers[key] || theme.tiers.any;
  if (key === 'any') return null;

  return (
    <span className="tier-shield" title={'name' in info ? info.name : ''}>
      🛡️ {info.label}: Lv {info.range}
    </span>
  );
}

