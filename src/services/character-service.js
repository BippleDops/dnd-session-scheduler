/**
 * Character sheet management service.
 */
const { getDb, generateUuid, nowTimestamp, logAction } = require('../db');

function getCharactersByPlayer(playerId) {
  return getDb().prepare(`SELECT * FROM characters WHERE player_id = ? AND status != 'Retired' ORDER BY name`).all(playerId);
}

function getCharacterById(characterId) {
  return getDb().prepare('SELECT * FROM characters WHERE character_id = ?').get(characterId);
}

function createCharacter(playerId, data) {
  const db = getDb();
  const id = generateUuid();
  db.prepare(`INSERT INTO characters (character_id, player_id, name, class, subclass, level, race,
    backstory, portrait_url, hp, max_hp, ac, str, dex, con, int_, wis, cha, proficiencies, equipment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
    .run(id, playerId, data.name, data.class || '', data.subclass || '', parseInt(data.level,10)||1,
      data.race || '', data.backstory || '', data.portraitUrl || '',
      parseInt(data.hp,10)||0, parseInt(data.maxHp,10)||0, parseInt(data.ac,10)||10,
      parseInt(data.str,10)||10, parseInt(data.dex,10)||10, parseInt(data.con,10)||10,
      parseInt(data.int,10)||10, parseInt(data.wis,10)||10, parseInt(data.cha,10)||10,
      data.proficiencies || '', data.equipment || '');
  logAction('CHARACTER_CREATED', `${data.name} created`, '', id);
  return { success: true, characterId: id };
}

function updateCharacter(characterId, playerId, data) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM characters WHERE character_id = ? AND player_id = ?').get(characterId, playerId);
  if (!existing) return { success: false, error: 'Character not found.' };

  const fields = { name:'name', class:'class', subclass:'subclass', race:'race', backstory:'backstory',
    portraitUrl:'portrait_url', proficiencies:'proficiencies', equipment:'equipment' };
  const intFields = { level:'level', hp:'hp', maxHp:'max_hp', ac:'ac', str:'str', dex:'dex', con:'con', int:'int_', wis:'wis', cha:'cha' };
  const updates = { modified_at: nowTimestamp() };

  for (const [k, col] of Object.entries(fields)) {
    if (data[k] !== undefined) updates[col] = String(data[k]).slice(0, 2000);
  }
  for (const [k, col] of Object.entries(intFields)) {
    if (data[k] !== undefined) updates[col] = parseInt(data[k], 10) || 0;
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE characters SET ${setClauses} WHERE character_id = ?`).run(...Object.values(updates), characterId);
  return { success: true };
}

function retireCharacter(characterId, playerId) {
  const db = getDb();
  db.prepare("UPDATE characters SET status = 'Retired', modified_at = datetime('now') WHERE character_id = ? AND player_id = ?")
    .run(characterId, playerId);
  return { success: true };
}

function getCharacterSessionHistory(characterId) {
  return getDb().prepare(`
    SELECT r.*, s.date, s.campaign, s.title
    FROM registrations r JOIN sessions s ON r.session_id = s.session_id
    WHERE r.char_name_snapshot = (SELECT name FROM characters WHERE character_id = ?)
    ORDER BY s.date DESC
  `).all(characterId);
}

function getCharacterLoot(characterId) {
  return getDb().prepare('SELECT * FROM loot WHERE character_id = ? ORDER BY created_at DESC').all(characterId);
}

function awardXP(characterId, xp) {
  // Simple milestone leveling: every 300 XP = 1 level
  const db = getDb();
  const char = db.prepare('SELECT level FROM characters WHERE character_id = ?').get(characterId);
  if (!char) return { success: false };
  const newLevel = Math.min(20, char.level + Math.floor(xp / 300));
  if (newLevel > char.level) {
    db.prepare('UPDATE characters SET level = ?, modified_at = datetime(\'now\') WHERE character_id = ?').run(newLevel, characterId);
  }
  return { success: true, newLevel };
}

module.exports = { getCharactersByPlayer, getCharacterById, createCharacter, updateCharacter, retireCharacter, getCharacterSessionHistory, getCharacterLoot, awardXP };

