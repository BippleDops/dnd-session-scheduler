/**
 * Encounter builder service.
 * Monster database + difficulty calculation using 5e XP thresholds.
 */
const { getDb, generateUuid } = require('../db');

// 5e XP thresholds by character level
const XP_THRESHOLDS = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

// Encounter multiplier based on monster count
function getEncounterMultiplier(monsterCount, partySize) {
  let mult;
  if (monsterCount === 1) mult = 1;
  else if (monsterCount === 2) mult = 1.5;
  else if (monsterCount <= 6) mult = 2;
  else if (monsterCount <= 10) mult = 2.5;
  else if (monsterCount <= 14) mult = 3;
  else mult = 4;
  // Adjust for party size
  if (partySize < 3) mult *= 1.5;
  else if (partySize >= 6) mult *= 0.5;
  return mult;
}

/**
 * Calculate encounter difficulty.
 * @param {number[]} partyLevels — array of character levels
 * @param {number[]} monsterXPs — array of XP values for each monster
 * @returns {{ difficulty: string, adjustedXP: number, thresholds: object }}
 */
function calculateDifficulty(partyLevels, monsterXPs) {
  // Sum party thresholds
  const thresholds = { easy: 0, medium: 0, hard: 0, deadly: 0 };
  for (const level of partyLevels) {
    const t = XP_THRESHOLDS[Math.min(Math.max(level, 1), 20)];
    thresholds.easy += t.easy;
    thresholds.medium += t.medium;
    thresholds.hard += t.hard;
    thresholds.deadly += t.deadly;
  }

  const totalXP = monsterXPs.reduce((a, b) => a + b, 0);
  const multiplier = getEncounterMultiplier(monsterXPs.length, partyLevels.length);
  const adjustedXP = Math.round(totalXP * multiplier);

  let difficulty = 'Trivial';
  if (adjustedXP >= thresholds.deadly) difficulty = 'Deadly';
  else if (adjustedXP >= thresholds.hard) difficulty = 'Hard';
  else if (adjustedXP >= thresholds.medium) difficulty = 'Medium';
  else if (adjustedXP >= thresholds.easy) difficulty = 'Easy';

  return { difficulty, adjustedXP, totalXP, multiplier, thresholds };
}

function seedMonsters() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM monsters').get().c;
  if (count > 0) return; // Already seeded
  const monsters = require('../data/srd-monsters');
  const insert = db.prepare(`INSERT OR IGNORE INTO monsters (monster_id, name, size, type, ac, hp,
    str, dex, con, int_, wis, cha, challenge_rating, xp, actions, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'srd')`);
  for (const m of monsters) {
    insert.run(generateUuid(), m.name, m.size, m.type, m.ac, m.hp,
      m.str || 10, m.dex || 10, m.con || 10, m.int || 10, m.wis || 10, m.cha || 10,
      m.cr, m.xp, m.actions || '', );
  }
  console.log(`[DB] Seeded ${monsters.length} SRD monsters`);
}

function searchMonsters(query, limit = 20) {
  const db = getDb();
  if (!query) return db.prepare('SELECT * FROM monsters ORDER BY challenge_rating, name LIMIT ?').all(limit);
  return db.prepare("SELECT * FROM monsters WHERE name LIKE ? OR type LIKE ? ORDER BY challenge_rating, name LIMIT ?")
    .all(`%${query}%`, `%${query}%`, limit);
}

function getMonsterById(id) {
  return getDb().prepare('SELECT * FROM monsters WHERE monster_id = ?').get(id);
}

module.exports = { calculateDifficulty, seedMonsters, searchMonsters, getMonsterById, XP_THRESHOLDS };
