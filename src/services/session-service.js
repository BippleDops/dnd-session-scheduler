/**
 * Session management service.
 * Ported from SessionService.gs + parts of Code.gs.
 */
const { getDb, generateUuid, nowTimestamp, normalizeDate, normalizeTime, logAction, getConfigValue } = require('../db');

const ACTION_TYPES = {
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_UPDATED: 'SESSION_UPDATED',
  SESSION_CANCELLED: 'SESSION_CANCELLED',
  SESSION_COMPLETED: 'SESSION_COMPLETED',
};

function getUpcomingSessions() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const sessions = db.prepare(`
    SELECT * FROM sessions
    WHERE date >= ? AND status = 'Scheduled'
    ORDER BY date, start_time
  `).all(today);

  return sessions.map(s => {
    const regs = db.prepare(`
      SELECT char_name_snapshot AS characterName,
             class_snapshot AS characterClass,
             level_snapshot AS characterLevel
      FROM registrations
      WHERE session_id = ? AND status IN ('Confirmed','Attended')
    `).all(s.session_id);

    const registeredCount = regs.length;
    const maxPlayers = s.max_players || 6;

    return {
      sessionId: s.session_id,
      date: normalizeDate(s.date),
      startTime: normalizeTime(s.start_time),
      endTime: normalizeTime(s.end_time),
      campaign: s.campaign || '',
      title: s.title || '',
      description: s.description || '',
      maxPlayers,
      registeredCount,
      spotsRemaining: Math.max(0, maxPlayers - registeredCount),
      roster: regs,
      status: s.status,
    };
  });
}

function getSessionById(sessionId, includePrivate = false) {
  const db = getDb();
  const s = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
  if (!s) return null;

  const regs = db.prepare(`
    SELECT r.*, p.name AS player_name, p.email AS player_email,
           p.accessibility_needs, p.dm_notes AS player_dm_notes, p.played_before
    FROM registrations r
    LEFT JOIN players p ON r.player_id = p.player_id
    WHERE r.session_id = ?
    ORDER BY r.signup_timestamp
  `).all(sessionId);

  const confirmed = regs.filter(r => r.status === 'Confirmed' || r.status === 'Attended');
  const maxPlayers = s.max_players || 6;

  const result = {
    sessionId: s.session_id,
    date: normalizeDate(s.date),
    startTime: normalizeTime(s.start_time),
    endTime: normalizeTime(s.end_time),
    campaign: s.campaign || '',
    title: s.title || '',
    description: s.description || '',
    maxPlayers,
    registeredCount: confirmed.length,
    spotsRemaining: Math.max(0, maxPlayers - confirmed.length),
    status: s.status,
    location: s.location || '',
    difficulty: s.difficulty || '',
    tags: s.tags || '',
    dmNotes: includePrivate ? (s.dm_notes || '') : '',
    roster: confirmed.map(r => ({
      characterName: r.char_name_snapshot || '',
      characterClass: r.class_snapshot || '',
      characterLevel: r.level_snapshot || 0,
    })),
  };

  if (includePrivate) {
    result.registrations = regs.map(r => ({
      registrationId: r.registration_id,
      playerId: r.player_id,
      playerName: r.player_name || '',
      playerEmail: r.player_email || '',
      characterName: r.char_name_snapshot || '',
      characterClass: r.class_snapshot || '',
      characterLevel: r.level_snapshot || 0,
      characterRace: r.race_snapshot || '',
      status: r.status,
      attendanceConfirmed: !!r.attendance_confirmed,
      accessibilityNeeds: r.accessibility_needs || '',
      dmNotes: r.player_dm_notes || '',
      playedBefore: r.played_before || '',
    }));
  }

  return result;
}

function createSessionRecord(data, adminEmail) {
  const db = getDb();
  const id = generateUuid();
  const duration = parseInt(data.duration, 10) || 4;
  const startParts = (data.startTime || '18:00').split(':');
  const endHour = parseInt(startParts[0], 10) + duration;
  const endTime = (endHour < 10 ? '0' : '') + endHour + ':' + (startParts[1] || '00');

  const dayOfWeek = new Date(data.date + 'T12:00:00').getDay();
  const dayType = (dayOfWeek === 0 || dayOfWeek === 6) ? 'Weekend' : 'Weeknight';

  db.prepare(`
    INSERT INTO sessions (session_id, date, day_type, start_time, duration, end_time,
      status, max_players, campaign, title, description, dm_notes,
      signup_deadline, location, tags, difficulty, co_dm, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    id, data.date, dayType, data.startTime, duration, endTime,
    parseInt(data.maxPlayers, 10) || 6,
    data.campaign || '', data.title || '', data.description || '', data.dmNotes || '',
    data.signupDeadline || null, data.location || '',
    data.tags || '', data.difficulty || '', data.coDM || ''
  );

  logAction(ACTION_TYPES.SESSION_CREATED,
    `${data.campaign} session created for ${data.date}`,
    adminEmail, id);

  return { success: true, sessionId: id };
}

function updateSessionRecord(sessionId, data, adminEmail) {
  const db = getDb();
  const s = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
  if (!s) return { success: false, error: 'Session not found.' };

  const updates = {};
  const fields = ['date', 'campaign', 'title', 'description', 'dm_notes', 'location',
    'tags', 'difficulty', 'co_dm', 'signup_deadline'];
  const camelMap = {
    date: 'date', campaign: 'campaign', title: 'title', description: 'description',
    dmNotes: 'dm_notes', location: 'location', tags: 'tags', difficulty: 'difficulty',
    coDM: 'co_dm', signupDeadline: 'signup_deadline',
  };

  for (const [camel, col] of Object.entries(camelMap)) {
    if (data[camel] !== undefined) updates[col] = data[camel];
  }
  if (data.maxPlayers !== undefined) updates.max_players = parseInt(data.maxPlayers, 10);
  if (data.startTime !== undefined) {
    updates.start_time = data.startTime;
    const dur = parseInt(data.duration, 10) || s.duration || 4;
    updates.duration = dur;
    const sp = data.startTime.split(':');
    const eh = parseInt(sp[0], 10) + dur;
    updates.end_time = (eh < 10 ? '0' : '') + eh + ':' + (sp[1] || '00');
  }
  updates.modified_at = nowTimestamp();

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE sessions SET ${setClauses} WHERE session_id = ?`)
    .run(...Object.values(updates), sessionId);

  logAction(ACTION_TYPES.SESSION_UPDATED, `Session updated: ${sessionId}`, adminEmail, sessionId);
  return { success: true };
}

function cancelSessionRecord(sessionId, notify, adminEmail) {
  const db = getDb();
  db.prepare(`UPDATE sessions SET status = 'Cancelled', modified_at = datetime('now') WHERE session_id = ?`)
    .run(sessionId);
  logAction(ACTION_TYPES.SESSION_CANCELLED, 'Session cancelled', adminEmail, sessionId);
  return { success: true };
}

function completeSessionRecord(sessionId, adminEmail) {
  const db = getDb();
  const s = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
  if (!s) return { success: false, error: 'Session not found.' };

  db.prepare(`UPDATE sessions SET status = 'Completed', modified_at = datetime('now') WHERE session_id = ?`)
    .run(sessionId);

  // Build session history entry
  const regs = db.prepare(`
    SELECT r.char_name_snapshot FROM registrations r
    WHERE r.session_id = ? AND r.status IN ('Confirmed','Attended')
  `).all(sessionId);

  const charNames = regs.map(r => r.char_name_snapshot).filter(Boolean).join(', ');

  db.prepare(`
    INSERT OR REPLACE INTO session_history
    (session_id, session_date, campaign, attendee_char_names, attendee_count, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(sessionId, normalizeDate(s.date), s.campaign, charNames, regs.length);

  logAction(ACTION_TYPES.SESSION_COMPLETED, `Session completed with ${regs.length} attendees`, adminEmail, sessionId);
  return { success: true };
}

function getAllSessionsAdmin(filters = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM sessions WHERE 1=1';
  const params = [];

  if (filters.status) { sql += ' AND status = ?'; params.push(filters.status); }
  if (filters.campaign) { sql += ' AND campaign = ?'; params.push(filters.campaign); }

  sql += ' ORDER BY date DESC, start_time';
  const sessions = db.prepare(sql).all(...params);

  return sessions.map(s => {
    const count = db.prepare(`
      SELECT COUNT(*) AS c FROM registrations
      WHERE session_id = ? AND status IN ('Confirmed','Attended')
    `).get(s.session_id).c;

    return {
      sessionId: s.session_id,
      date: normalizeDate(s.date),
      startTime: normalizeTime(s.start_time),
      endTime: normalizeTime(s.end_time),
      campaign: s.campaign || '',
      title: s.title || '',
      maxPlayers: s.max_players || 6,
      registeredCount: count,
      status: s.status,
    };
  });
}

function getSessionHistoryRecords(filters = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM session_history WHERE 1=1';
  const params = [];

  if (filters.campaign) { sql += ' AND campaign = ?'; params.push(filters.campaign); }
  if (filters.dateFrom) { sql += ' AND session_date >= ?'; params.push(filters.dateFrom); }
  if (filters.dateTo) { sql += ' AND session_date <= ?'; params.push(filters.dateTo); }
  if (filters.recapPending) { sql += ' AND (dm_post_notes IS NULL OR dm_post_notes = "")'; }

  sql += ' ORDER BY session_date DESC';
  return db.prepare(sql).all(...params).map(h => ({
    sessionId: h.session_id,
    sessionDate: h.session_date,
    campaign: h.campaign || '',
    attendeeCharNames: h.attendee_char_names || '',
    attendeeCount: h.attendee_count || 0,
    recapDrafted: !!h.recap_drafted,
    infoSheetDrafted: !!h.info_sheet_drafted,
    dmPostNotes: h.dm_post_notes || '',
  }));
}

function updateSessionHistoryNotes(sessionId, notes) {
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM session_history WHERE session_id = ?').get(sessionId);
  if (!exists) return { success: false, error: 'History entry not found.' };
  db.prepare('UPDATE session_history SET dm_post_notes = ?, modified_at = datetime(\'now\') WHERE session_id = ?')
    .run(notes, sessionId);
  return { success: true };
}

function cloneSessionRecord(sessionId, newDate, adminEmail) {
  const db = getDb();
  const s = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
  if (!s) return { success: false, error: 'Session not found.' };
  return createSessionRecord({
    date: newDate, startTime: normalizeTime(s.start_time), campaign: s.campaign,
    title: s.title, description: s.description, maxPlayers: s.max_players,
    duration: s.duration, location: s.location, difficulty: s.difficulty,
    tags: s.tags, coDM: s.co_dm, dmNotes: s.dm_notes,
  }, adminEmail);
}

function autoCompletePastSessions() {
  const db = getDb();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const cutoff = yesterday.toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT session_id FROM sessions WHERE date < ? AND status = 'Scheduled'
  `).all(cutoff);

  let count = 0;
  for (const r of rows) {
    completeSessionRecord(r.session_id, 'System');
    count++;
  }
  return { success: true, count };
}

function getCampaignList() {
  return getConfigValue('CAMPAIGN_LIST', 'Aethermoor,Aquabyssos,Terravor,Two Cities')
    .split(',').map(c => c.trim());
}

module.exports = {
  getUpcomingSessions,
  getSessionById,
  createSessionRecord,
  updateSessionRecord,
  cancelSessionRecord,
  completeSessionRecord,
  getAllSessionsAdmin,
  getSessionHistoryRecords,
  updateSessionHistoryNotes,
  cloneSessionRecord,
  autoCompletePastSessions,
  getCampaignList,
  ACTION_TYPES,
};

