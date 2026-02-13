/**
 * SRD 5e Monster data — a curated subset for the encounter builder.
 * Source: D&D 5e SRD (Open Game License)
 */
module.exports = [
  { name: 'Goblin', size: 'Small', type: 'Humanoid', ac: 15, hp: 7, cr: 0.25, xp: 50, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8, actions: 'Scimitar: +4, 1d6+2 slashing. Shortbow: +4, 1d6+2 piercing.' },
  { name: 'Skeleton', size: 'Medium', type: 'Undead', ac: 13, hp: 13, cr: 0.25, xp: 50, str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5, actions: 'Shortsword: +4, 1d6+2 piercing. Shortbow: +4, 1d6+2 piercing.' },
  { name: 'Zombie', size: 'Medium', type: 'Undead', ac: 8, hp: 22, cr: 0.25, xp: 50, str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5, actions: 'Slam: +3, 1d6+1 bludgeoning. Undead Fortitude.' },
  { name: 'Wolf', size: 'Medium', type: 'Beast', ac: 13, hp: 11, cr: 0.25, xp: 50, str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6, actions: 'Bite: +4, 2d4+2 piercing. Pack Tactics. Keen Senses.' },
  { name: 'Kobold', size: 'Small', type: 'Humanoid', ac: 12, hp: 5, cr: 0.125, xp: 25, str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8, actions: 'Dagger: +4, 1d4+2 piercing. Sling: +4, 1d4+2 bludgeoning. Pack Tactics.' },
  { name: 'Bandit', size: 'Medium', type: 'Humanoid', ac: 12, hp: 11, cr: 0.125, xp: 25, str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10, actions: 'Scimitar: +3, 1d6+1 slashing. Light crossbow: +3, 1d8+1 piercing.' },
  { name: 'Orc', size: 'Medium', type: 'Humanoid', ac: 13, hp: 15, cr: 0.5, xp: 100, str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10, actions: 'Greataxe: +5, 1d12+3 slashing. Javelin: +5, 1d6+3 piercing. Aggressive.' },
  { name: 'Bugbear', size: 'Medium', type: 'Humanoid', ac: 16, hp: 27, cr: 1, xp: 200, str: 15, dex: 14, con: 13, int: 8, wis: 11, cha: 9, actions: 'Morningstar: +4, 2d8+2 piercing. Javelin: +4, 1d6+2 piercing. Surprise Attack.' },
  { name: 'Ogre', size: 'Large', type: 'Giant', ac: 11, hp: 59, cr: 2, xp: 450, str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7, actions: 'Greatclub: +6, 2d8+4 bludgeoning. Javelin: +6, 2d6+4 piercing.' },
  { name: 'Owlbear', size: 'Large', type: 'Monstrosity', ac: 13, hp: 59, cr: 3, xp: 700, str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7, actions: 'Multiattack. Beak: +7, 1d10+5 piercing. Claws: +7, 2d8+5 slashing.' },
  { name: 'Troll', size: 'Large', type: 'Giant', ac: 15, hp: 84, cr: 5, xp: 1800, str: 18, dex: 13, con: 20, int: 7, wis: 9, cha: 7, actions: 'Multiattack. Bite: +7, 1d6+4 piercing. Claws: +7, 2d6+4 slashing. Regeneration 10.' },
  { name: 'Young Dragon (Red)', size: 'Large', type: 'Dragon', ac: 18, hp: 178, cr: 10, xp: 5900, str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19, actions: 'Multiattack. Bite: +10, 2d10+6. Claws: +10, 2d6+6. Fire Breath (12d6, DC 17).' },
  { name: 'Adult Dragon (Red)', size: 'Huge', type: 'Dragon', ac: 19, hp: 256, cr: 17, xp: 18000, str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21, actions: 'Multiattack. Bite: +14, 2d10+8. Claws: +14, 2d6+8. Fire Breath (18d6, DC 21). Frightful Presence.' },
  { name: 'Lich', size: 'Medium', type: 'Undead', ac: 17, hp: 135, cr: 21, xp: 33000, str: 11, dex: 16, con: 16, int: 20, wis: 14, cha: 16, actions: 'Paralyzing Touch: +12, 3d6 cold + DC 18 paralysis. Spellcasting (9th level). Legendary Actions.' },
  { name: 'Giant Spider', size: 'Large', type: 'Beast', ac: 14, hp: 26, cr: 1, xp: 200, str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4, actions: 'Bite: +5, 1d8+3 + 2d8 poison (DC 11). Web: restrained (DC 12).' },
  { name: 'Mimic', size: 'Medium', type: 'Monstrosity', ac: 12, hp: 58, cr: 2, xp: 450, str: 17, dex: 12, con: 15, int: 5, wis: 13, cha: 8, actions: 'Pseudopod: +5, 1d8+3 bludgeoning. Bite: +5, 1d8+3 + 1d8 acid. Adhesive. Shapechanger.' },
  { name: 'Beholder', size: 'Large', type: 'Aberration', ac: 18, hp: 180, cr: 13, xp: 10000, str: 10, dex: 14, con: 18, int: 17, wis: 15, cha: 17, actions: 'Bite: +5, 4d6 piercing. Eye Rays (3 random). Antimagic Cone. Legendary Actions.' },
  { name: 'Gelatinous Cube', size: 'Large', type: 'Ooze', ac: 6, hp: 84, cr: 2, xp: 450, str: 14, dex: 3, con: 20, int: 1, wis: 6, cha: 1, actions: 'Pseudopod: +4, 3d6 acid. Engulf (DC 12). Transparent.' },
  { name: 'Wight', size: 'Medium', type: 'Undead', ac: 14, hp: 45, cr: 3, xp: 700, str: 15, dex: 14, con: 16, int: 10, wis: 13, cha: 15, actions: 'Multiattack. Longsword: +4, 1d10+2 slashing. Life Drain: +4, 1d6+2 necrotic + max HP reduction.' },
  { name: 'Wraith', size: 'Medium', type: 'Undead', ac: 13, hp: 67, cr: 5, xp: 1800, str: 6, dex: 16, con: 16, int: 12, wis: 14, cha: 15, actions: 'Life Drain: +6, 4d8+3 necrotic + max HP reduction. Create Specter. Incorporeal Movement.' },
];
