// Tavern Board Design Tokens
export const theme = {
  colors: {
    woodDark: '#2c1810',
    woodMedium: '#4a2c1a',
    woodLight: '#6b3d22',
    parchment: '#f4e4c1',
    parchmentDark: '#d4c4a1',
    ink: '#1a1209',
    inkFaded: '#5c4a32',
    gold: '#c9a959',
    goldBright: '#e8c84a',
    candle: '#ff9d2e',
    bloodRed: '#8b0000',
    deepBlue: '#1a3a5c',
    teal: '#1a4a4a',
    amber: '#b8860b',
  },
  campaigns: {
    Aethermoor: { color: '#1a3a5c', label: 'Aethermoor' },
    Aquabyssos: { color: '#1a4a4a', label: 'Aquabyssos' },
    Terravor: { color: '#8b0000', label: 'Terravor' },
    'Two Cities': { color: '#b8860b', label: 'Two Cities' },
  },
  tiers: {
    any: { label: 'Any Level', range: '1-20', min: 1, max: 20, color: '#c9a959', name: 'All Adventurers' },
    tier1: { label: 'Tier 1', range: '1-4', min: 1, max: 4, color: '#22c55e', name: 'Local Heroes' },
    tier2: { label: 'Tier 2', range: '5-10', min: 5, max: 10, color: '#3b82f6', name: 'Heroes of the Realm' },
    tier3: { label: 'Tier 3', range: '11-16', min: 11, max: 16, color: '#a855f7', name: 'Masters of the Realm' },
    tier4: { label: 'Tier 4', range: '17-20', min: 17, max: 20, color: '#ef4444', name: 'Masters of the World' },
  },
} as const;

export type CampaignName = keyof typeof theme.campaigns;
export type TierKey = keyof typeof theme.tiers;

