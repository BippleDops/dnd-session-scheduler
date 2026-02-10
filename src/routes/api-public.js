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

// ── Calendar Feeds ──

/** Subscribable iCal feed — all upcoming sessions. Paste URL into any calendar app. */
router.get('/calendar/feed.ics', (req, res) => {
  const sessions = getUpcomingSessions();
  const events = sessions.map(s => {
    const dateStr = String(s.date).replace(/-/g, '');
    const startTime = String(s.startTime).replace(':', '') + '00';
    const endTime = String(s.endTime).replace(':', '') + '00';
    const spots = s.spotsRemaining > 0 ? `${s.spotsRemaining} spots open` : 'FULL';
    const tierInfo = s.levelTier && s.levelTier !== 'any' ? ` [${tierLabel(s.levelTier)}]` : '';
    return `BEGIN:VEVENT\r\nUID:${s.sessionId}@dndsignup.get-suss.com\r\nDTSTART;TZID=America/Chicago:${dateStr}T${startTime}\r\nDTEND;TZID=America/Chicago:${dateStr}T${endTime}\r\nSUMMARY:${(s.title || s.campaign)}${tierInfo}\r\nDESCRIPTION:${s.campaign} — ${spots}${s.description ? '\\n' + s.description : ''}\\nSign up: ${process.env.BASE_URL || ''}/signup?sessionId=${s.sessionId}\r\nLOCATION:${s.location || ''}\r\nEND:VEVENT`;
  }).join('\r\n');
  const cal = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//DnD Session Scheduler//EN\r\nX-WR-CALNAME:D&D Sessions\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nREFRESH-INTERVAL;VALUE=DURATION:PT1H\r\nX-PUBLISHED-TTL:PT1H\r\n${events}\r\nEND:VCALENDAR`;
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Cache-Control', 'no-cache, max-age=3600');
  res.send(cal);
});

/** Personal iCal feed — only sessions the user is registered for. Uses token auth. */
router.get('/calendar/my-feed.ics', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).send('Token required');
  const db = getDb();
  const player = db.prepare('SELECT * FROM players WHERE feed_token = ?').get(token);
  if (!player) return res.status(401).send('Invalid token');

  const regs = db.prepare(`
    SELECT r.*, s.date, s.start_time, s.end_time, s.campaign, s.title, s.location, s.description
    FROM registrations r JOIN sessions s ON r.session_id = s.session_id
    WHERE r.player_id = ? AND r.status IN ('Confirmed','Attended','Waitlisted') AND s.status = 'Scheduled'
    ORDER BY s.date
  `).all(player.player_id);

  const events = regs.map(r => {
    const dateStr = String(r.date).replace(/-/g, '');
    const startTime = String(r.start_time).replace(':', '') + '00';
    const endTime = String(r.end_time).replace(':', '') + '00';
    return `BEGIN:VEVENT\r\nUID:${r.registration_id}@dndsignup.get-suss.com\r\nDTSTART;TZID=America/Chicago:${dateStr}T${startTime}\r\nDTEND;TZID=America/Chicago:${dateStr}T${endTime}\r\nSUMMARY:D&D: ${r.title || r.campaign} (${r.char_name_snapshot})\r\nDESCRIPTION:Playing ${r.char_name_snapshot} — ${r.campaign}\r\nLOCATION:${r.location || ''}\r\nSTATUS:${r.status === 'Waitlisted' ? 'TENTATIVE' : 'CONFIRMED'}\r\nEND:VEVENT`;
  }).join('\r\n');
  const cal = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//DnD Session Scheduler//EN\r\nX-WR-CALNAME:My D&D Sessions\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nREFRESH-INTERVAL;VALUE=DURATION:PT1H\r\nX-PUBLISHED-TTL:PT1H\r\n${events}\r\nEND:VCALENDAR`;
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.send(cal);
});

/** Generate/return a personal feed token for the authenticated user. */
router.get('/me/feed-token', (req, res) => {
  if (!req.user || !req.user.email) return res.status(401).json({ error: 'Not authenticated' });
  const db = getDb();
  const player = db.prepare('SELECT player_id, feed_token FROM players WHERE email = ?').get(req.user.email.toLowerCase());
  if (!player) return res.json({ token: null });
  let token = player.feed_token;
  if (!token) {
    token = require('crypto').randomBytes(24).toString('hex');
    db.prepare('UPDATE players SET feed_token = ? WHERE player_id = ?').run(token, player.player_id);
  }
  res.json({ token, url: `${process.env.BASE_URL || ''}/api/calendar/my-feed.ics?token=${token}` });
});

function tierLabel(tier) {
  const tiers = { tier1: 'Tier 1: Lv 1-4', tier2: 'Tier 2: Lv 5-10', tier3: 'Tier 3: Lv 11-16', tier4: 'Tier 4: Lv 17-20' };
  return tiers[tier] || '';
}

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

// ── Signup (REQUIRES LOGIN — uses authenticated email, not form input) ──

router.post('/signup', (req, res) => {
  if (!req.user || !req.user.email) {
    return res.status(401).json({ success: false, message: 'You must sign in with Google before signing up.' });
  }
  // Override email/name with authenticated user data — prevents impersonation
  const formData = { ...req.body, email: req.user.email, name: req.user.name || req.body.name };
  const result = processSignup(formData);
  res.json(result);
});

// ── My data (ALL require login) ──

router.get('/me/characters', (req, res) => {
  if (!req.user || !req.user.email) return res.status(401).json({ error: 'Not authenticated' });
  // Only return the authenticated user's characters — no email param accepted
  res.json(getPlayerCharactersByEmail(req.user.email));
});

router.get('/me/registrations', (req, res) => {
  if (!req.user || !req.user.email) return res.status(401).json({ error: 'Not authenticated' });
  res.json(getMyRegistrationsData(req.user.email));
});

router.delete('/me/registrations/:id', (req, res) => {
  if (!req.user || !req.user.email) return res.status(401).json({ error: 'Not authenticated' });
  res.json(cancelMyRegistration(req.params.id, req.user.email));
});

router.get('/me/profile', (req, res) => {
  if (!req.user || !req.user.email) return res.status(401).json(null);
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.json(null);
  const chars = getPlayerCharactersByEmail(req.user.email);
  res.json({
    playerId: player.player_id,
    name: player.name,
    email: player.email,
    preferredCampaign: player.preferred_campaign || '',
    accessibilityNeeds: player.accessibility_needs || '',
    dmNotes: player.dm_notes || '',
    playedBefore: player.played_before || '',
    profileComplete: !!(player.name && player.played_before),
    characters: chars,
  });
});

router.put('/me/profile', (req, res) => {
  if (!req.user || !req.user.email) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.json({ success: false, message: 'Player not found.' });

  const db = getDb();
  const updates = req.body;
  const safe = {};
  if (updates.name) safe.name = sanitize(updates.name, 100);
  if (updates.preferredCampaign !== undefined) safe.preferred_campaign = sanitize(updates.preferredCampaign, 100);
  if (updates.accessibilityNeeds !== undefined) safe.accessibility_needs = sanitize(updates.accessibilityNeeds, 1000);
  if (updates.dmNotes !== undefined) safe.dm_notes = sanitize(updates.dmNotes, 1000);
  if (updates.playedBefore !== undefined) safe.played_before = sanitize(updates.playedBefore, 20);
  safe.modified_at = nowTimestamp();

  const setClauses = Object.keys(safe).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE players SET ${setClauses} WHERE player_id = ?`)
    .run(...Object.values(safe), player.player_id);
  res.json({ success: true });
});

/** Strip HTML tags and enforce length limit. */
function sanitize(str, maxLen) {
  if (!str) return '';
  return String(str).replace(/<[^>]*>/g, '').replace(/on\w+\s*=/gi, '').slice(0, maxLen || 500);
}

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
  if (!req.user || !req.user.email) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  const email = req.user.email;
  const player = getPlayerByEmail(email);
  if (!player) return res.json({ success: false, message: 'Player not found.' });

  const db = getDb();
  db.prepare(`INSERT INTO email_log (log_id, timestamp, type, recipient, subject, status, related_id)
    VALUES (?, datetime('now'), 'Feedback', ?, ?, 'OK', ?)`)
    .run(generateUuid(), email, `Rating: ${req.body.rating} — ${req.body.comment || ''}`, req.body.sessionId);
  res.json({ success: true });
});

// ── Session Comments (A2) ──

router.get('/sessions/:id/comments', (req, res) => {
  const db = getDb();
  const comments = db.prepare(`
    SELECT c.*, p.name AS player_name, p.photo_url
    FROM session_comments c
    LEFT JOIN players p ON c.player_id = p.player_id
    WHERE c.session_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

router.post('/sessions/:id/comments', (req, res) => {
  if (!req.user || !req.user.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(403).json({ error: 'Player not found' });
  const text = sanitize(req.body.text, 1000);
  if (!text) return res.json({ success: false, message: 'Comment text is required.' });
  const db = getDb();
  db.prepare(`INSERT INTO session_comments (comment_id, session_id, player_id, text, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))`).run(generateUuid(), req.params.id, player.player_id, text);
  res.json({ success: true });
});

// ── Notifications (A3) ──

router.get('/me/notifications', (req, res) => {
  if (!req.user || !req.user.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.json({ notifications: [], unread: 0 });
  const { getUnreadNotifications, getUnreadCount } = require('../services/notification-service');
  res.json({
    notifications: getUnreadNotifications(player.player_id),
    unread: getUnreadCount(player.player_id),
  });
});

router.post('/me/notifications/read-all', (req, res) => {
  if (!req.user || !req.user.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.json({ success: false });
  const { markAllRead } = require('../services/notification-service');
  markAllRead(player.player_id);
  res.json({ success: true });
});

router.post('/me/notifications/:id/read', (req, res) => {
  if (!req.user || !req.user.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.json({ success: false });
  const { markRead } = require('../services/notification-service');
  markRead(req.params.id, player.player_id);
  res.json({ success: true });
});

module.exports = router;

