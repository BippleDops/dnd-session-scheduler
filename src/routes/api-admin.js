/**
 * Admin API endpoints.
 * All routes require admin middleware.
 */
const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const {
  getAllSessionsAdmin, getSessionById, createSessionRecord, updateSessionRecord,
  cancelSessionRecord, completeSessionRecord, getSessionHistoryRecords,
  updateSessionHistoryNotes, cloneSessionRecord, autoCompletePastSessions,
} = require('../services/session-service');
const {
  getAllPlayersAdmin, getPlayerSessionHistory, setPlayerStatus, updatePlayerRecord,
} = require('../services/player-service');
const {
  cancelRegistration, markRegistrationAttendance,
} = require('../services/registration-service');
const { exportData, exportSessionRoster } = require('../services/export-service');
const { draftDMInfoSheet, draftDMRecapReminder, dailyReminderCheck, sendEmail } = require('../services/reminder-service');
const { performBackup, getLastBackupTimestamp } = require('../services/backup-service');
const { getDb, getAllConfigValues, setConfigValue, logAction, generateUuid, nowTimestamp } = require('../db');
const { wrapEmailTemplate } = require('../email/templates');

const router = express.Router();
router.use(requireAdmin);

// ── Sessions ──

router.get('/sessions', (req, res) => {
  res.json(getAllSessionsAdmin(req.query));
});

router.get('/sessions/:id', (req, res) => {
  res.json(getSessionById(req.params.id, true));
});

router.post('/sessions', (req, res) => {
  res.json(createSessionRecord(req.body, req.user.email));
});

router.put('/sessions/:id', (req, res) => {
  res.json(updateSessionRecord(req.params.id, req.body, req.user.email));
});

router.post('/sessions/:id/cancel', (req, res) => {
  res.json(cancelSessionRecord(req.params.id, req.body.notify, req.user.email));
});

router.post('/sessions/:id/complete', (req, res) => {
  res.json(completeSessionRecord(req.params.id, req.user.email));
});

router.post('/sessions/:id/clone', (req, res) => {
  res.json(cloneSessionRecord(req.params.id, req.body.newDate, req.user.email));
});

router.get('/sessions/:id/roster-csv', (req, res) => {
  const csv = exportSessionRoster(req.params.id);
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', 'attachment; filename="session-roster.csv"');
  res.send(csv);
});

router.post('/sessions/:id/draft-info', async (req, res) => {
  const result = await draftDMInfoSheet(req.params.id);
  res.json(result);
});

router.post('/sessions/:id/draft-recap', async (req, res) => {
  const result = await draftDMRecapReminder(req.params.id);
  res.json(result);
});

router.post('/auto-complete', (req, res) => {
  res.json(autoCompletePastSessions());
});

// ── Registrations ──

router.get('/pending-registrations', (req, res) => {
  const { getPendingRegistrations } = require('../services/registration-service');
  res.json(getPendingRegistrations());
});

router.post('/registrations/:id/approve', (req, res) => {
  const { approveRegistration } = require('../services/registration-service');
  res.json(approveRegistration(req.params.id, req.user.email));
});

router.post('/registrations/:id/reject', (req, res) => {
  const { rejectRegistration } = require('../services/registration-service');
  res.json(rejectRegistration(req.params.id, req.user.email, req.body.reason));
});

router.post('/registrations/:id/cancel', (req, res) => {
  res.json(cancelRegistration(req.params.id));
});

router.post('/registrations/:id/attendance', (req, res) => {
  res.json(markRegistrationAttendance(req.params.id, req.body.attended));
});

// ── Players ──

router.get('/players', (req, res) => {
  res.json(getAllPlayersAdmin(req.query));
});

router.get('/players/:id/history', (req, res) => {
  res.json(getPlayerSessionHistory(req.params.id));
});

router.post('/players/:id/status', (req, res) => {
  res.json(setPlayerStatus(req.params.id, req.body.status));
});

router.put('/players/:id', (req, res) => {
  res.json(updatePlayerRecord(req.params.id, req.body));
});

// ── Session History ──

router.get('/history', (req, res) => {
  res.json(getSessionHistoryRecords(req.query));
});

router.put('/history/:id/notes', (req, res) => {
  res.json(updateSessionHistoryNotes(req.params.id, req.body.notes));
});

// ── Config ──

router.get('/config', (req, res) => {
  res.json(getAllConfigValues());
});

router.put('/config/:key', (req, res) => {
  setConfigValue(req.params.key, req.body.value);
  logAction('CONFIG_UPDATED', `Config updated: ${req.params.key}`, req.user.email, req.params.key);
  res.json({ success: true });
});

// ── Logs ──

router.get('/logs', (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page, 10) || 1;
  const perPage = parseInt(req.query.perPage, 10) || 50;

  let sql = 'SELECT * FROM admin_log WHERE 1=1';
  let countSql = 'SELECT COUNT(*) AS total FROM admin_log WHERE 1=1';
  const params = [];

  if (req.query.actionType) {
    sql += ' AND action_type = ?';
    countSql += ' AND action_type = ?';
    params.push(req.query.actionType);
  }

  const total = db.prepare(countSql).get(...params).total;
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  const logs = db.prepare(sql).all(...params, perPage, (page - 1) * perPage);

  res.json({
    logs: logs.map(l => ({
      LogID: l.log_id, Timestamp: l.timestamp, ActionType: l.action_type,
      Details: l.details, TriggeredBy: l.triggered_by,
    })),
    total, page, totalPages: Math.ceil(total / perPage),
  });
});

// ── Dashboard ──

router.get('/dashboard', (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const monthEnd = new Date(); monthEnd.setDate(monthEnd.getDate() + 30);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);

    const upcoming = db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE date >= ? AND status = 'Scheduled'`).get(today).c;
    const activePlayers = db.prepare(`SELECT COUNT(*) AS c FROM players WHERE active_status = 'Active'`).get().c;
    const sessionsThisWeek = db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE date >= ? AND date <= ? AND status = 'Scheduled'`).get(today, weekEndStr).c;
    const sessionsThisMonth = db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE date >= ? AND date <= ? AND status = 'Scheduled'`).get(today, monthEndStr).c;

    const thisWeekSessions = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.session_id AND r.status IN ('Confirmed','Attended')) AS registered_count
      FROM sessions s WHERE s.date >= ? AND s.date <= ? AND s.status = 'Scheduled'
      ORDER BY s.date, s.start_time
    `).all(today, weekEndStr).map(s => ({
      sessionId: s.session_id, date: s.date, startTime: s.start_time,
      campaign: s.campaign, title: s.title, maxPlayers: s.max_players,
      registeredCount: s.registered_count,
    }));

    const recentLogs = db.prepare('SELECT * FROM admin_log ORDER BY timestamp DESC LIMIT 10').all().map(l => ({
      ActionType: l.action_type, Timestamp: l.timestamp, Details: l.details,
    }));

    const lastBackup = getLastBackupTimestamp();

    res.json({
      upcomingCount: upcoming, activePlayerCount: activePlayers,
      sessionsThisWeek, sessionsThisMonth,
      thisWeekSessions, recentLogs, lastBackup,
    });
  } catch (e) {
    res.json({ error: e.message, upcomingCount: 0, activePlayerCount: 0, sessionsThisWeek: 0, sessionsThisMonth: 0, thisWeekSessions: [], recentLogs: [] });
  }
});

// ── Export ──

router.get('/export/:type', (req, res) => {
  const csv = exportData(req.params.type);
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', `attachment; filename="${req.params.type}-export.csv"`);
  res.send(csv);
});

// ── Triggers (reminders, backup) ──

router.post('/trigger-reminders', async (req, res) => {
  const result = await dailyReminderCheck();
  res.json(result);
});

router.post('/trigger-backup', (req, res) => {
  performBackup();
  res.json({ success: true, message: 'Backup started.' });
});

// ── Bulk email ──

router.post('/bulk-email', async (req, res) => {
  const { recipients, subject, body } = req.body;
  let count = 0;
  const htmlBody = wrapEmailTemplate(subject, body);
  for (const to of recipients) {
    const result = await sendEmail(to, subject, htmlBody);
    if (result) count++;
  }
  logAction('BULK_EMAIL_DRAFTED', `${count} bulk emails processed`, req.user.email, '');
  res.json({ success: true, draftCount: count });
});

// ── Campaign Admin ──
const { getAllCampaigns, getCampaignById, updateCampaign } = require('../services/campaign-service');

router.get('/campaigns', (req, res) => {
  res.json(getAllCampaigns());
});

router.put('/campaigns/:id', (req, res) => {
  const result = updateCampaign(req.params.id, req.body);
  res.json(result);
});

// ── Recurring Sessions ──
router.put('/campaigns/:id/recurring', (req, res) => {
  const db = getDb();
  const { schedule, exceptions } = req.body;
  db.prepare('UPDATE campaigns SET recurring_schedule = ?, recurring_exceptions = ? WHERE campaign_id = ?')
    .run(schedule ? JSON.stringify(schedule) : null, exceptions ? JSON.stringify(exceptions) : '[]', req.params.id);
  logAction('RECURRING_UPDATED', `Recurring schedule updated for campaign ${req.params.id}`, req.user.email, req.params.id);
  res.json({ success: true });
});

router.post('/campaigns/:id/generate-sessions', (req, res) => {
  const { generateRecurringSessions } = require('../services/recurring-service');
  const result = generateRecurringSessions(req.params.id, parseInt(req.body.weeks, 10) || 4);
  res.json({ success: true, ...result });
});

// ── Encounter Builder ──
router.get('/monsters', (req, res) => {
  const { searchMonsters } = require('../services/encounter-service');
  res.json(searchMonsters(req.query.q || '', parseInt(req.query.limit, 10) || 30));
});

router.post('/monsters', (req, res) => {
  const db = getDb();
  const id = generateUuid();
  const m = req.body;
  db.prepare(`INSERT INTO monsters (monster_id, name, size, type, ac, hp, str, dex, con, int_, wis, cha, challenge_rating, xp, actions, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'custom')`)
    .run(id, m.name, m.size||'Medium', m.type||'', parseInt(m.ac,10)||10, parseInt(m.hp,10)||1,
      parseInt(m.str,10)||10, parseInt(m.dex,10)||10, parseInt(m.con,10)||10, parseInt(m.int,10)||10,
      parseInt(m.wis,10)||10, parseInt(m.cha,10)||10, parseFloat(m.cr)||0, parseInt(m.xp,10)||0, m.actions||'');
  res.json({ success: true, monsterId: id });
});

router.post('/encounter/calculate', (req, res) => {
  const { calculateDifficulty } = require('../services/encounter-service');
  const { partyLevels, monsterXPs } = req.body;
  if (!partyLevels?.length || !monsterXPs?.length) return res.json({ difficulty: 'Unknown', adjustedXP: 0, thresholds: {} });
  res.json(calculateDifficulty(partyLevels, monsterXPs));
});

// ── NPCs ──
router.get('/npcs', (req, res) => {
  const campaignId = req.query.campaignId;
  const npcs = campaignId
    ? getDb().prepare('SELECT * FROM npcs WHERE campaign_id = ? ORDER BY name').all(campaignId)
    : getDb().prepare('SELECT * FROM npcs ORDER BY name').all();
  res.json(npcs);
});

router.post('/npcs', (req, res) => {
  const id = generateUuid();
  const n = req.body;
  getDb().prepare('INSERT INTO npcs (npc_id, campaign_id, name, description, location, disposition, portrait_url, voice_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, n.campaignId||null, n.name, n.description||'', n.location||'', n.disposition||'neutral', n.portraitUrl||'', n.voiceNotes||'');
  res.json({ success: true, npcId: id });
});

router.put('/npcs/:id', (req, res) => {
  const n = req.body;
  getDb().prepare('UPDATE npcs SET name=?, description=?, location=?, disposition=?, portrait_url=?, voice_notes=? WHERE npc_id=?')
    .run(n.name, n.description||'', n.location||'', n.disposition||'neutral', n.portraitUrl||'', n.voiceNotes||'', req.params.id);
  res.json({ success: true });
});

router.delete('/npcs/:id', (req, res) => {
  getDb().prepare('DELETE FROM npcs WHERE npc_id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Locations ──
router.get('/locations', (req, res) => {
  const campaignId = req.query.campaignId;
  const locs = campaignId
    ? getDb().prepare('SELECT * FROM locations WHERE campaign_id = ? ORDER BY name').all(campaignId)
    : getDb().prepare('SELECT * FROM locations ORDER BY name').all();
  res.json(locs);
});

router.post('/locations', (req, res) => {
  const id = generateUuid();
  const l = req.body;
  getDb().prepare('INSERT INTO locations (location_id, campaign_id, name, description, type, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, l.campaignId||null, l.name, l.description||'', l.type||'', l.notes||'');
  res.json({ success: true, locationId: id });
});

// ── Plot Threads ──
router.get('/plot-threads', (req, res) => {
  const campaignId = req.query.campaignId;
  const threads = campaignId
    ? getDb().prepare('SELECT * FROM plot_threads WHERE campaign_id = ? ORDER BY status, priority DESC, created_at DESC').all(campaignId)
    : getDb().prepare('SELECT * FROM plot_threads ORDER BY status, priority DESC, created_at DESC').all();
  res.json(threads);
});

router.post('/plot-threads', (req, res) => {
  const id = generateUuid();
  const t = req.body;
  getDb().prepare('INSERT INTO plot_threads (thread_id, campaign_id, title, description, priority) VALUES (?, ?, ?, ?, ?)')
    .run(id, t.campaignId||null, t.title, t.description||'', t.priority||'normal');
  res.json({ success: true, threadId: id });
});

router.put('/plot-threads/:id', (req, res) => {
  const t = req.body;
  const updates = [];
  const params = [];
  if (t.title !== undefined) { updates.push('title=?'); params.push(t.title); }
  if (t.description !== undefined) { updates.push('description=?'); params.push(t.description); }
  if (t.status) { updates.push('status=?'); params.push(t.status); if (t.status === 'resolved') updates.push("resolved_at=datetime('now')"); }
  if (t.priority) { updates.push('priority=?'); params.push(t.priority); }
  if (updates.length === 0) return res.json({ success: false });
  params.push(req.params.id);
  getDb().prepare(`UPDATE plot_threads SET ${updates.join(', ')} WHERE thread_id = ?`).run(...params);
  res.json({ success: true });
});

// ── V10: Analytics & Insights ──
router.get('/insights', (req, res) => {
  const { getDMInsights } = require('../services/analytics-service');
  res.json(getDMInsights());
});

router.get('/engagement-scores', (req, res) => {
  const db = getDb();
  const scores = db.prepare(`SELECT e.*, p.name FROM engagement_scores e JOIN players p ON e.player_id = p.player_id ORDER BY e.overall_score DESC`).all();
  res.json(scores);
});

router.post('/engagement-refresh', (req, res) => {
  const { refreshAllEngagementScores } = require('../services/analytics-service');
  const result = refreshAllEngagementScores();
  res.json({ success: true, ...result });
});

router.get('/previously-on/:campaign', (req, res) => {
  const { generatePreviouslyOn } = require('../services/analytics-service');
  const result = generatePreviouslyOn(req.params.campaign);
  res.json(result || { summary: 'No previous session recap found.' });
});

router.get('/generate-npc', (req, res) => {
  const { generateRandomNPC } = require('../services/analytics-service');
  res.json(generateRandomNPC(req.query.role || 'neutral'));
});

// ── Guest Invites ──
router.post('/sessions/:id/invite', (req, res) => {
  const crypto = require('crypto');
  const token = crypto.randomBytes(16).toString('hex');
  const maxUses = parseInt(req.body.maxUses, 10) || 5;
  const expiresIn = parseInt(req.body.expiresInDays, 10) || 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresIn);
  getDb().prepare('INSERT INTO guest_tokens (token, session_id, created_by, max_uses, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(token, req.params.id, req.user.email, maxUses, expiresAt.toISOString());
  const url = `${process.env.BASE_URL || ''}/signup?sessionId=${req.params.id}&invite=${token}`;
  res.json({ success: true, token, url, maxUses, expiresAt: expiresAt.toISOString() });
});

// ── Email Log ──
router.get('/emails', (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page, 10) || 1;
  const perPage = 50;
  const status = req.query.status || '';
  const type = req.query.type || '';

  let sql = 'SELECT * FROM email_log WHERE 1=1';
  let countSql = 'SELECT COUNT(*) AS total FROM email_log WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; countSql += ' AND status = ?'; params.push(status); }
  if (type) { sql += ' AND type = ?'; countSql += ' AND type = ?'; params.push(type); }

  const total = db.prepare(countSql).get(...params).total;
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  const emails = db.prepare(sql).all(...params, perPage, (page - 1) * perPage);

  res.json({ emails, total, page, totalPages: Math.ceil(total / perPage) });
});

router.post('/emails/:id/resend', async (req, res) => {
  const db = getDb();
  const email = db.prepare('SELECT * FROM email_log WHERE log_id = ?').get(req.params.id);
  if (!email) return res.status(404).json({ error: 'Email not found' });
  // We can't resend since we don't store the body — log the attempt
  logAction('EMAIL_RESEND_REQUESTED', `Resend requested for ${email.recipient}: ${email.subject}`, req.user.email, req.params.id);
  res.json({ success: true, message: 'Resend logged. Note: email body is not stored, so the original content cannot be reconstructed.' });
});

// ── Email Test ──
router.post('/email-test', async (req, res) => {
  const { sendEmail } = require('../services/reminder-service');
  const { wrapEmailTemplate } = require('../email/templates');
  const html = wrapEmailTemplate('Test Email', `<h2 style="color:#8b0000;">Test Email</h2><p>This is a test email from the D&D Session Scheduler.</p><p>If you're reading this, your SMTP configuration is working! 🎲</p><p>Sent by: ${req.user.email}</p>`);
  const result = await sendEmail(req.user.email, 'D&D Session Scheduler — Test Email', html);
  if (result) {
    res.json({ success: true, message: `Test email sent to ${req.user.email}` });
  } else {
    res.json({ success: false, message: 'Failed to send. Check SMTP configuration and server logs.' });
  }
});

// ── Health Dashboard (detailed, admin-only) ──
router.get('/health-detail', (req, res) => {
  const db = getDb();
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const tables = ['sessions', 'players', 'registrations', 'characters', 'campaigns',
    'session_history', 'notifications', 'messages', 'dice_rolls', 'admin_log'];
  const rowCounts = {};
  for (const t of tables) {
    try { rowCounts[t] = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c; } catch { rowCounts[t] = 0; }
  }

  const dbPath = path.join(__dirname, '..', '..', 'data', 'scheduler.db');
  let dbSizeMB = 0;
  try { dbSizeMB = Math.round(fs.statSync(dbPath).size / 1024 / 1024 * 10) / 10; } catch {}

  const mem = process.memoryUsage();
  const { getPresenceCount } = require('./api-sse');

  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    uptimeHuman: formatUptime(process.uptime()),
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
    database: { sizeMB: dbSizeMB, tables: rowCounts },
    lastBackup: getLastBackupTimestamp(),
    system: {
      nodeVersion: process.version,
      platform: os.platform(),
      cpus: os.cpus().length,
      totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
      freeMemMB: Math.round(os.freemem() / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  });
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

// ── Character Admin (level adjustment, etc.) ──
const { getCharacterById, updateCharacter: updateCharAdmin } = require('../services/character-service');

router.put('/characters/:id/level', (req, res) => {
  const db = require('../db').getDb();
  const level = parseInt(req.body.level, 10);
  if (!level || level < 1 || level > 20) return res.status(400).json({ error: 'Invalid level (1-20)' });
  db.prepare('UPDATE characters SET level = ?, modified_at = datetime(\'now\') WHERE character_id = ?').run(level, req.params.id);
  logAction('CHARACTER_LEVELED', `Character ${req.params.id} set to level ${level}`, req.user.email, req.params.id);
  res.json({ success: true });
});

module.exports = router;
