/**
 * Public API endpoints.
 * Replaces google.script.run calls from public pages.
 */
const express = require('express');
const { isAdmin } = require('../middleware/auth');
const { generateCsrfToken, validateCancelToken } = require('../middleware/csrf');
const { getUpcomingSessions, getSessionById, getCampaignList } = require('../services/session-service');
const { processSignup, cancelMyRegistration, getMyRegistrationsData } = require('../services/registration-service');
const { getPlayerByEmail, getPlayerCharactersByEmail } = require('../services/player-service');
const { getDb, generateUuid, nowTimestamp } = require('../db');

const router = express.Router();

// ── Sessions ──

router.get('/sessions', (req, res) => {
  res.json(getUpcomingSessions());
});

router.get('/sessions/:id', (req, res) => {
  const session = getSessionById(req.params.id, false);
  res.json(session);
});

router.get('/sessions/:id/ics', (req, res) => {
  const session = getSessionById(req.params.id, false);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const dateStr = String(session.date).replace(/-/g, '');
  const startTime = String(session.startTime).replace(':', '') + '00';
  const endTime = String(session.endTime).replace(':', '') + '00';
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//DnD Session Scheduler//EN\r\nBEGIN:VEVENT\r\nDTSTART;TZID=America/Chicago:${dateStr}T${startTime}\r\nDTEND;TZID=America/Chicago:${dateStr}T${endTime}\r\nSUMMARY:${session.title || session.campaign}\r\nDESCRIPTION:D&D Session - ${session.campaign}\r\nEND:VEVENT\r\nEND:VCALENDAR`;

  res.set('Content-Type', 'text/calendar');
  res.set('Content-Disposition', 'attachment; filename="session.ics"');
  res.send(ics);
});

// ── Campaigns ──

router.get('/campaigns', (req, res) => {
  res.json(getCampaignList());
});

// ── Auth / Role ──

router.get('/me/role', (req, res) => {
  res.json({
    email: req.user ? req.user.email : '',
    isAdmin: req.user ? isAdmin(req.user) : false,
    name: req.user ? req.user.name : '',
    photo: req.user ? req.user.photo : '',
  });
});

// ── CSRF ──

router.get('/csrf-token', (req, res) => {
  const sessionId = req.sessionID || '';
  res.json({ token: generateCsrfToken(sessionId) });
});

// ── Signup ──

router.post('/signup', (req, res) => {
  const result = processSignup(req.body);
  res.json(result);
});

// ── My data (requires login) ──

router.get('/me/characters', (req, res) => {
  const email = req.query.email || (req.user ? req.user.email : '');
  res.json(getPlayerCharactersByEmail(email));
});

router.get('/me/registrations', (req, res) => {
  const email = req.user ? req.user.email : '';
  res.json(getMyRegistrationsData(email));
});

router.delete('/me/registrations/:id', (req, res) => {
  const email = req.user ? req.user.email : '';
  res.json(cancelMyRegistration(req.params.id, email));
});

router.get('/me/profile', (req, res) => {
  const email = req.user ? req.user.email : '';
  if (!email) return res.json(null);
  const player = getPlayerByEmail(email);
  if (!player) return res.json(null);
  const chars = getPlayerCharactersByEmail(email);
  res.json({
    playerId: player.player_id,
    name: player.name,
    email: player.email,
    preferredCampaign: player.preferred_campaign || '',
    accessibilityNeeds: player.accessibility_needs || '',
    dmNotes: player.dm_notes || '',
    playedBefore: player.played_before || '',
    characters: chars,
  });
});

router.put('/me/profile', (req, res) => {
  const email = req.user ? req.user.email : '';
  if (!email) return res.json({ success: false, message: 'Not authenticated.' });
  const player = getPlayerByEmail(email);
  if (!player) return res.json({ success: false, message: 'Player not found.' });

  const db = getDb();
  const updates = req.body;
  const safe = {};
  if (updates.name) safe.name = String(updates.name).slice(0, 100);
  if (updates.preferredCampaign !== undefined) safe.preferred_campaign = String(updates.preferredCampaign).slice(0, 100);
  if (updates.accessibilityNeeds !== undefined) safe.accessibility_needs = String(updates.accessibilityNeeds).slice(0, 1000);
  if (updates.dmNotes !== undefined) safe.dm_notes = String(updates.dmNotes).slice(0, 1000);
  safe.modified_at = nowTimestamp();

  const setClauses = Object.keys(safe).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE players SET ${setClauses} WHERE player_id = ?`)
    .run(...Object.values(safe), player.player_id);
  res.json({ success: true });
});

// ── Cancel by token ──

router.post('/cancel-by-token', (req, res) => {
  const { token } = req.body;
  const regId = validateCancelToken(token);
  if (!regId) return res.json({ success: false, message: 'This cancel link has expired or already been used.' });

  const { cancelRegistration } = require('../services/registration-service');
  const result = cancelRegistration(regId);
  res.json(result.success
    ? { success: true, message: 'Your registration has been cancelled.' }
    : { success: false, message: result.error || 'Could not cancel registration.' });
});

// ── Recaps ──

router.get('/recaps', (req, res) => {
  const db = getDb();
  let sql = `SELECT * FROM session_history WHERE dm_post_notes IS NOT NULL AND dm_post_notes != '' `;
  const params = [];
  if (req.query.campaign) { sql += ' AND campaign = ?'; params.push(req.query.campaign); }
  sql += ' ORDER BY session_date DESC';

  const recaps = db.prepare(sql).all(...params).map(h => ({
    sessionId: h.session_id,
    date: h.session_date,
    campaign: h.campaign || '',
    attendees: h.attendee_char_names || '',
    attendeeCount: h.attendee_count || 0,
    recap: h.dm_post_notes,
  }));
  res.json(recaps);
});

// ── Feedback ──

router.post('/feedback', (req, res) => {
  const email = req.user ? req.user.email : '';
  if (!email) return res.json({ success: false, message: 'Not authenticated.' });
  const player = getPlayerByEmail(email);
  if (!player) return res.json({ success: false, message: 'Player not found.' });

  const db = getDb();
  db.prepare(`INSERT INTO email_log (log_id, timestamp, type, recipient, subject, status, related_id)
    VALUES (?, datetime('now'), 'Feedback', ?, ?, 'OK', ?)`)
    .run(generateUuid(), email, `Rating: ${req.body.rating} — ${req.body.comment || ''}`, req.body.sessionId);
  res.json({ success: true });
});

module.exports = router;

