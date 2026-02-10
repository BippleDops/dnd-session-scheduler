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
      SELECT * FROM sessions WHERE date >= ? AND date <= ? AND status = 'Scheduled' ORDER BY date, start_time
    `).all(today, weekEndStr).map(s => {
      const count = db.prepare(`SELECT COUNT(*) AS c FROM registrations WHERE session_id = ? AND status IN ('Confirmed','Attended')`).get(s.session_id).c;
      return { sessionId: s.session_id, date: s.date, startTime: s.start_time, campaign: s.campaign, title: s.title, maxPlayers: s.max_players, registeredCount: count };
    });

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

module.exports = router;

