'use client';
import { campaignColor } from '@/lib/utils';

export default function WaxSeal({ campaign, size = 36 }: { campaign: string; size?: number }) {
  const color = campaignColor(campaign);
  const initials = campaign.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <span
      className="wax-seal"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.3 }}
      title={campaign}
    >
      {initials}
    </span>
  );
}

