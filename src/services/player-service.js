/**
 * Player management service.
 * Ported from PlayerService.gs.
 */
const { getDb, generateUuid, nowTimestamp, logAction } = require('../db');

function getPlayerByEmail(email) {
  if (!email) return null;
  return getDb().prepare('SELECT * FROM players WHERE email = ?').get(email.toLowerCase());
}

function getPlayerById(playerId) {
  return getDb().prepare('SELECT * FROM players WHERE player_id = ?').get(playerId);
}

/**
 * Creates or updates a player record based on signup data.
 * @returns {{ playerId: string, isNew: boolean }}
 */
function upsertPlayer(data) {
  const db = getDb();
  const email = (data.email || '').toLowerCase().trim();
  const existing = db.prepare('SELECT * FROM players WHERE email = ?').get(email);

  if (existing) {
    // Update player-level fields only
    const updates = { modified_at: nowTimestamp() };
    if (data.name) updates.name = data.name;
    if (data.preferredCampaign !== undefined) updates.preferred_campaign = data.preferredCampaign;
    if (data.accessibilityNeeds !== undefined) updates.accessibility_needs = data.accessibilityNeeds;
    if (data.dmNotes !== undefined) updates.dm_notes = data.dmNotes;
    if (data.playedBefore) updates.played_before = data.playedBefore;

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE players SET ${setClauses} WHERE player_id = ?`)
      .run(...Object.values(updates), existing.player_id);

    return { playerId: existing.player_id, isNew: false };
  }

  const playerId = generateUuid();
  db.prepare(`
    INSERT INTO players (player_id, name, email, preferred_campaign, accessibility_needs,
      dm_notes, played_before, registered_at, active_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'Active')
  `).run(
    playerId, data.name || '', email,
    data.preferredCampaign || '', data.accessibilityNeeds || '',
    data.dmNotes || '', data.playedBefore || ''
  );

  return { playerId, isNew: true };
}

/**
 * Returns a player's distinct characters from registration history.
 */
function getPlayerCharactersByEmail(email) {
  if (!email) return [];
  const db = getDb();
  const player = db.prepare('SELECT player_id FROM players WHERE email = ?').get(email.toLowerCase());
  if (!player) return [];

  return db.prepare(`
    SELECT DISTINCT char_name_snapshot AS characterName,
           class_snapshot AS characterClass,
           level_snapshot AS characterLevel,
           race_snapshot AS characterRace
    FROM registrations
    WHERE player_id = ? AND char_name_snapshot IS NOT NULL AND char_name_snapshot != ''
    ORDER BY signup_timestamp DESC
  `).all(player.player_id);
}

/**
 * Returns all players for admin view with character data.
 */
function getAllPlayersAdmin(filters = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM players WHERE 1=1';
  const params = [];
  if (filters.status) { sql += ' AND active_status = ?'; params.push(filters.status); }
  sql += ' ORDER BY name';

  const players = db.prepare(sql).all(...params);
  return players.map(p => {
    const chars = db.prepare(`
      SELECT DISTINCT char_name_snapshot AS name,
             class_snapshot AS class,
             level_snapshot AS level,
             race_snapshot AS race
      FROM registrations
      WHERE player_id = ? AND char_name_snapshot IS NOT NULL AND char_name_snapshot != ''
    `).all(p.player_id);

    const totalRegs = db.prepare('SELECT COUNT(*) AS c FROM registrations WHERE player_id = ?')
      .get(p.player_id).c;
    const attended = db.prepare(`SELECT COUNT(*) AS c FROM registrations WHERE player_id = ? AND status = 'Attended'`)
      .get(p.player_id).c;

    return {
      PlayerID: p.player_id,
      Name: p.name,
      Email: p.email,
      PreferredCampaign: p.preferred_campaign || '',
      AccessibilityNeeds: p.accessibility_needs || '',
      DMNotes: p.dm_notes || '',
      PlayedBefore: p.played_before || '',
      ActiveStatus: p.active_status,
      characters: chars,
      totalRegistrations: totalRegs,
      sessionsAttended: attended,
    };
  });
}

function getPlayerSessionHistory(playerId) {
  const db = getDb();
  return db.prepare(`
    SELECT r.registration_id, r.char_name_snapshot AS characterName,
           r.class_snapshot AS characterClass, r.level_snapshot AS characterLevel,
           r.status, s.date AS sessionDate, s.campaign
    FROM registrations r
    JOIN sessions s ON r.session_id = s.session_id
    WHERE r.player_id = ?
    ORDER BY s.date DESC
  `).all(playerId);
}

function setPlayerStatus(playerId, status) {
  const db = getDb();
  db.prepare('UPDATE players SET active_status = ?, modified_at = datetime(\'now\') WHERE player_id = ?')
    .run(status, playerId);
  return { success: true };
}

function updatePlayerRecord(playerId, updates) {
  const db = getDb();
  const colMap = {
    name: 'name', preferredCampaign: 'preferred_campaign',
    accessibilityNeeds: 'accessibility_needs', dmNotes: 'dm_notes',
  };
  const safeUpdates = { modified_at: nowTimestamp() };
  for (const [k, col] of Object.entries(colMap)) {
    if (updates[k] !== undefined) safeUpdates[col] = updates[k];
  }
  const setClauses = Object.keys(safeUpdates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE players SET ${setClauses} WHERE player_id = ?`)
    .run(...Object.values(safeUpdates), playerId);
  return { success: true };
}

module.exports = {
  getPlayerByEmail,
  getPlayerById,
  upsertPlayer,
  getPlayerCharactersByEmail,
  getAllPlayersAdmin,
  getPlayerSessionHistory,
  setPlayerStatus,
  updatePlayerRecord,
};

