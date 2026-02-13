/**
 * Express server entry point.
 * D&D Session Scheduler — self-hosted.
 */
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const cron = require('node-cron');

const rateLimit = require('express-rate-limit');
const { initializeDatabase, getConfigValue } = require('./db');
const { router: authRouter, initPassport } = require('./routes/auth');
const pageRoutes = require('./routes/pages');
const apiPublic = require('./routes/api-public');
const apiAdmin = require('./routes/api-admin');
const { injectUser } = require('./middleware/auth');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// ── Database ──
initializeDatabase();

// ── Compression ──
app.use(compression());

// ── Security ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", 'https://accounts.google.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── Trust proxy (Cloudflare Tunnel) — must be set before session middleware ──
app.set('trust proxy', 1);

// ── Body parsing ──
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Sessions ──
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  console.warn('[SECURITY] SESSION_SECRET is missing or too short. Set a random 64+ character string in .env');
}
app.use(session({
  store: new SQLiteStore({ dir: path.join(__dirname, '..', 'data'), db: 'sessions.sqlite' }),
  secret: sessionSecret || 'change-me-please-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production' && process.env.BASE_URL?.startsWith('https'),
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  },
  proxy: true, // trust Cloudflare proxy
}));

// ── Passport ──
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  initPassport();
  app.use(passport.initialize());
  app.use(passport.session());
}

// ── Template engine ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// ── Static files (with caching) ──
app.use('/_next/static', express.static(path.join(__dirname, '..', 'public', '_next', 'static'), {
  maxAge: '1y',
  immutable: true,
}));
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // HTML files get shorter cache + revalidation
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  },
}));

// ── Inject user into all templates ──
app.use(injectUser);

// ── Request logging (skip static assets and health checks) ──
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    // Skip logging for static assets, health checks, and SSE keepalives
    if (req.path.startsWith('/health') || req.path.startsWith('/_next/') ||
        req.path.startsWith('/styles') || req.path.endsWith('.js') ||
        req.path.endsWith('.css') || req.path.endsWith('.ico') ||
        req.path.endsWith('.png') || req.path.endsWith('.svg') ||
        req.path.endsWith('.woff') || req.path.endsWith('.woff2')) return;
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms ${req.user ? req.user.email : 'anon'}`);
  });
  next();
});

// ── API Rate Limiting ──
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
  skip: (req) => req.path === '/health',
});
app.use('/api/', apiLimiter);

// ── Routes ──
app.use('/auth', authRouter);
app.use('/api', apiPublic);
app.use('/api/admin', apiAdmin);
app.use('/api/sse', require('./routes/api-sse'));
app.use('/api/dice', require('./routes/api-dice'));
app.use('/api/initiative', require('./routes/api-initiative'));
app.use('/api', require('./routes/api-v3'));
app.use('/api', require('./routes/api-v4'));

// Serve React static export for non-API routes
// EJS routes kept as fallback for pages not yet in React
app.use('/', pageRoutes);

// React SPA fallback: serve .html files for client-side routes
// Pre-build the set of available HTML files at startup to avoid sync fs checks per request
const _staticHtmlFiles = new Map();
(function buildHtmlFileSet(dir, prefix) {
  const fs = require('fs');
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const urlPath = prefix + '/' + entry.name;
      if (entry.isDirectory()) {
        buildHtmlFileSet(fullPath, urlPath);
      } else if (entry.name.endsWith('.html')) {
        _staticHtmlFiles.set(urlPath, fullPath);
        // Also map /foo to /foo.html and /foo/ to /foo/index.html
        if (entry.name === 'index.html') {
          _staticHtmlFiles.set(prefix || '/', fullPath);
        } else {
          _staticHtmlFiles.set(urlPath.replace(/\.html$/, ''), fullPath);
        }
      }
    }
  } catch { /* directory doesn't exist yet during build */ }
})(path.join(__dirname, '..', 'public'), '');

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) return next();
  const htmlFile = _staticHtmlFiles.get(req.path);
  if (htmlFile) return res.sendFile(htmlFile);
  next();
});

// ── Health check ──
app.get('/health', (req, res) => {
  try {
    // Verify DB is accessible with a lightweight query
    require('./db').getDb().prepare('SELECT 1').get();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

// ── Cron jobs ──
// Daily reminders at configured hour
const triggerHour = parseInt(getConfigValue('REMINDER_TRIGGER_HOUR', '8'), 10);
cron.schedule(`0 ${triggerHour} * * *`, async () => {
  console.log(`[Cron] Running daily reminder check at ${triggerHour}:00`);
  try {
    const { dailyReminderCheck } = require('./services/reminder-service');
    await dailyReminderCheck();
  } catch (e) { console.error('Cron reminder error:', e); }
}, { timezone: 'America/Chicago' });

// Weekly digest email (configurable day/hour, default Sunday 6 PM)
const digestDay = parseInt(getConfigValue('DIGEST_DAY', '0'), 10);
const digestHour = parseInt(getConfigValue('DIGEST_HOUR', '18'), 10);
cron.schedule(`0 ${digestHour} * * ${digestDay}`, async () => {
  console.log('[Cron] Sending weekly digest emails');
  try {
    const { getDb, normalizeDate, normalizeTime } = require('./db');
    const db = getDb();
    const { sendEmail, playerWantsEmail, getUnsubscribeUrl } = require('./services/reminder-service');
    const { buildWeeklyDigestEmail } = require('./email/templates');

    // Get upcoming sessions for the next 7 days
    const today = new Date().toISOString().slice(0, 10);
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    const upcoming = db.prepare("SELECT * FROM sessions WHERE date >= ? AND date <= ? AND status = 'Scheduled' ORDER BY date").all(today, weekEnd.toISOString().slice(0, 10));
    const upcomingSessions = upcoming.map(s => ({ title: s.title, campaign: s.campaign, date: normalizeDate(s.date), startTime: normalizeTime(s.start_time), spotsRemaining: Math.max(0, (s.max_players || 6) - (db.prepare("SELECT COUNT(*) as c FROM registrations WHERE session_id = ? AND status IN ('Confirmed','Attended')").get(s.session_id).c)) }));

    // Recent recaps from past 7 days
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const recentRecaps = db.prepare("SELECT * FROM session_history WHERE dm_post_notes IS NOT NULL AND dm_post_notes != '' AND session_date >= ? ORDER BY session_date DESC LIMIT 5").all(weekAgo.toISOString().slice(0, 10)).map(h => ({ campaign: h.campaign, date: h.session_date, recap: h.dm_post_notes }));

    // Send to all active players who want digest
    const players = db.prepare("SELECT * FROM players WHERE active_status = 'Active'").all();
    let sent = 0;
    for (const p of players) {
      if (!p.email || !playerWantsEmail(p.player_id, 'digest')) continue;
      const html = buildWeeklyDigestEmail(p.name, upcomingSessions, recentRecaps, []);
      const result = await sendEmail(p.email, '⚔️ This Week in D&D', html);
      if (result) sent++;
    }
    if (sent > 0) console.log(`[Cron] Sent ${sent} weekly digest emails`);
  } catch (e) { console.error('Cron digest error:', e); }
}, { timezone: 'America/Chicago' });

// RSVP confirmation emails: 48h before sessions (runs at 9 AM)
cron.schedule('0 9 * * *', async () => {
  console.log('[Cron] Sending RSVP confirmation emails');
  try {
    const { getDb } = require('./db');
    const { normalizeDate, normalizeTime } = require('./db');
    const db = getDb();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2);
    const dateStr = targetDate.toISOString().slice(0, 10);

    const sessions = db.prepare("SELECT * FROM sessions WHERE date = ? AND status = 'Scheduled'").all(dateStr);
    const { sendEmail, hasEmailBeenSent, markEmailSent, playerWantsEmail } = require('./services/reminder-service');
    const { buildRsvpEmail, getEmailSubject } = require('./email/templates');
    const crypto = require('crypto');
    const secret = process.env.SESSION_SECRET || 'rsvp-secret';
    let sent = 0;

    for (const session of sessions) {
      const regs = db.prepare(`SELECT r.*, p.name, p.email FROM registrations r JOIN players p ON r.player_id = p.player_id
        WHERE r.session_id = ? AND r.status = 'Confirmed' AND r.rsvp_status IS NULL`).all(session.session_id);
      const sessionData = { date: session.date, startTime: normalizeTime(session.start_time), endTime: normalizeTime(session.end_time), campaign: session.campaign, title: session.title };

      for (const reg of regs) {
        if (!reg.email || hasEmailBeenSent(reg.player_id, session.session_id, 'rsvp')) continue;
        if (!playerWantsEmail(reg.player_id, 'reminders')) continue;
        const token = crypto.createHmac('sha256', secret).update(reg.registration_id + 'rsvp').digest('hex').slice(0, 32);
        const yesUrl = `${process.env.BASE_URL || ''}/api/rsvp?token=${token}&response=yes`;
        const noUrl = `${process.env.BASE_URL || ''}/api/rsvp?token=${token}&response=no`;
        const html = buildRsvpEmail(sessionData, reg.name, reg.char_name_snapshot || 'your character', yesUrl, noUrl);
        const result = await sendEmail(reg.email, getEmailSubject('rsvp', sessionData), html);
        if (result) { markEmailSent(reg.player_id, session.session_id, 'rsvp'); sent++; }
      }
    }
    if (sent > 0) console.log(`[Cron] Sent ${sent} RSVP emails`);
  } catch (e) { console.error('Cron RSVP error:', e); }
}, { timezone: 'America/Chicago' });

// Generate recurring sessions daily at midnight
cron.schedule('0 0 * * *', () => {
  console.log('[Cron] Generating recurring sessions');
  try {
    const { generateAllRecurringSessions } = require('./services/recurring-service');
    const result = generateAllRecurringSessions();
    if (result.totalCreated > 0) console.log(`[Cron] Created ${result.totalCreated} recurring sessions across ${result.campaignsChecked} campaigns`);
  } catch (e) { console.error('Cron recurring error:', e); }
}, { timezone: 'America/Chicago' });

// Auto-complete past sessions at 1 AM
cron.schedule('0 1 * * *', () => {
  console.log('[Cron] Auto-completing past sessions');
  try {
    const { autoCompletePastSessions } = require('./services/session-service');
    const result = autoCompletePastSessions();
    if (result.count > 0) console.log(`[Cron] Auto-completed ${result.count} past sessions`);
  } catch (e) { console.error('Cron auto-complete error:', e); }
}, { timezone: 'America/Chicago' });

// Daily backup at 2 AM
cron.schedule('0 2 * * *', () => {
  console.log('[Cron] Running daily backup');
  try {
    const { performBackup } = require('./services/backup-service');
    performBackup();
  } catch (e) { console.error('Cron backup error:', e); }
}, { timezone: 'America/Chicago' });

// No-show follow-up: 24h after completed sessions
cron.schedule('0 12 * * *', async () => {
  console.log('[Cron] Checking for no-show follow-ups');
  try {
    const { getDb, normalizeDate } = require('./db');
    const db = getDb();
    const { sendEmail, hasEmailBeenSent, markEmailSent, playerWantsEmail } = require('./services/reminder-service');
    const { buildNoShowEmail } = require('./email/templates');

    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    const noShows = db.prepare(`SELECT r.player_id, r.session_id, p.name, p.email, s.campaign, s.date
      FROM registrations r JOIN players p ON r.player_id = p.player_id JOIN sessions s ON r.session_id = s.session_id
      WHERE r.status = 'No-Show' AND s.date = ? AND s.status = 'Completed'`).all(dateStr);

    let sent = 0;
    for (const ns of noShows) {
      if (!ns.email || hasEmailBeenSent(ns.player_id, ns.session_id, 'noshow') || !playerWantsEmail(ns.player_id, 'reminders')) continue;
      const html = buildNoShowEmail({ date: normalizeDate(ns.date), campaign: ns.campaign }, ns.name);
      const result = await sendEmail(ns.email, `We missed you — ${ns.campaign}`, html);
      if (result) { markEmailSent(ns.player_id, ns.session_id, 'noshow'); sent++; }
    }
    if (sent > 0) console.log(`[Cron] Sent ${sent} no-show follow-up emails`);
  } catch (e) { console.error('Cron no-show error:', e); }
}, { timezone: 'America/Chicago' });

// Inactivity re-engagement: monthly check for inactive players
cron.schedule('0 14 1 * *', async () => {
  console.log('[Cron] Checking for inactive player re-engagement');
  try {
    const { getDb, normalizeDate, normalizeTime } = require('./db');
    const db = getDb();
    const { sendEmail, playerWantsEmail } = require('./services/reminder-service');
    const { buildInactivityEmail } = require('./email/templates');

    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const inactivePlayers = db.prepare(`
      SELECT p.player_id, p.name, p.email FROM players p
      WHERE p.active_status = 'Active' AND p.email IS NOT NULL
      AND p.player_id NOT IN (
        SELECT DISTINCT r.player_id FROM registrations r
        JOIN sessions s ON r.session_id = s.session_id
        WHERE s.date >= ? AND r.status IN ('Confirmed','Attended')
      )
    `).all(cutoff.toISOString().slice(0, 10));

    const upcoming = db.prepare("SELECT * FROM sessions WHERE date >= date('now') AND status = 'Scheduled' ORDER BY date LIMIT 5").all();
    const upcomingSessions = upcoming.map(s => ({
      title: s.title, campaign: s.campaign, date: normalizeDate(s.date),
      spotsRemaining: Math.max(0, (s.max_players || 6) - (db.prepare("SELECT COUNT(*) as c FROM registrations WHERE session_id = ? AND status IN ('Confirmed','Attended')").get(s.session_id).c)),
    }));

    let sent = 0;
    for (const p of inactivePlayers) {
      if (!playerWantsEmail(p.player_id, 'digest')) continue;
      const html = buildInactivityEmail(p.name, upcomingSessions);
      const result = await sendEmail(p.email, '🗡️ We miss you, adventurer!', html);
      if (result) sent++;
    }
    if (sent > 0) console.log(`[Cron] Sent ${sent} inactivity re-engagement emails`);
  } catch (e) { console.error('Cron inactivity error:', e); }
}, { timezone: 'America/Chicago' });

// Auto-briefing: 48h before sessions, send briefing emails
cron.schedule('0 10 * * *', async () => {
  console.log('[Cron] Checking for sessions needing auto-briefing');
  try {
    const { getDb } = require('./db');
    const db = getDb();
    // Find sessions in ~48 hours
    const upcoming = db.prepare(`
      SELECT s.*, sp.previously_on, sp.dm_teaser FROM sessions s
      LEFT JOIN session_prep sp ON s.session_id = sp.session_id
      WHERE s.status = 'Scheduled' AND s.date = date('now', '+2 days')
    `).all();
    if (upcoming.length === 0) return;

    const { sendEmail, wrapEmailTemplate } = require('./services/reminder-service');
    for (const session of upcoming) {
      const regs = db.prepare(`SELECT r.*, p.name, p.email FROM registrations r JOIN players p ON r.player_id = p.player_id WHERE r.session_id = ? AND r.status IN ('Confirmed','Attended')`).all(session.session_id);
      if (regs.length === 0) continue;

      // Get previous session recap
      const prevSession = db.prepare(`SELECT h.dm_post_notes FROM sessions s LEFT JOIN session_history h ON s.session_id = h.session_id WHERE s.campaign = ? AND s.date < ? AND s.status = 'Completed' ORDER BY s.date DESC LIMIT 1`).get(session.campaign, session.date);
      const campaign = db.prepare('SELECT * FROM campaigns WHERE name = ?').get(session.campaign);
      const rosterList = regs.map(r => `${r.char_name_snapshot || r.name}`).join(', ');

      for (const reg of regs) {
        let body = `<h2>⚔️ Session Briefing: ${session.title || session.campaign}</h2>`;
        body += `<p><strong>Date:</strong> ${session.date} at ${session.start_time}</p>`;
        body += `<p><strong>Your character:</strong> ${reg.char_name_snapshot || 'TBD'} (Level ${reg.char_level_snapshot || '?'})</p>`;
        body += `<p><strong>Party:</strong> ${rosterList}</p>`;
        if (session.previously_on || prevSession?.dm_post_notes) {
          body += `<h3>Last time on ${session.campaign}...</h3><p>${session.previously_on || prevSession.dm_post_notes.slice(0, 500)}</p>`;
        }
        if (session.dm_teaser) body += `<h3>DM's Note</h3><p>${session.dm_teaser}</p>`;
        if (campaign?.foundry_url) body += `<p>🎮 <a href="${campaign.foundry_url}">Connect to Foundry</a></p>`;
        const html = wrapEmailTemplate ? wrapEmailTemplate(`Session Briefing: ${session.title || session.campaign}`, body) : body;
        await sendEmail(reg.email, `⚔️ Session Briefing: ${session.title || session.campaign} — ${session.date}`, html);
      }
      console.log(`[Cron] Sent briefing for session ${session.session_id} to ${regs.length} players`);
    }
  } catch (e) { console.error('Cron briefing error:', e); }
}, { timezone: 'America/Chicago' });

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
  res.status(500).render('error', { message: err.message || 'Something went wrong. Please try again.', currentPage: '' });
});

// ── Start ──
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`D&D Session Scheduler running on http://0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Verify SMTP configuration at startup
  try {
    const { verifySmtp } = require('./services/reminder-service');
    const autoSend = (process.env.EMAIL_AUTO_SEND || getConfigValue('EMAIL_AUTO_SEND', 'TRUE')).toUpperCase() === 'TRUE';
    const result = await verifySmtp();
    if (result.ok) {
      console.log(`[Email] ✓ SMTP verified — auto-send: ${autoSend ? 'ON' : 'OFF (draft mode)'}`);
    } else {
      console.warn(`[Email] ⚠ ${result.message}${autoSend ? ' — emails will fail until fixed' : ''}`);
    }
  } catch (e) {
    console.warn(`[Email] ⚠ SMTP check error: ${e.message}`);
  }
});

// ── Graceful shutdown ──
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    try { require('./db').getDb().close(); } catch (e) {}
    console.log('Server closed. Database connection closed.');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => { console.error('Forced shutdown'); process.exit(1); }, 10000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

