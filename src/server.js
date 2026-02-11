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
const path = require('path');
const cron = require('node-cron');

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

// ── Security ──
app.use(helmet({
  contentSecurityPolicy: false, // EJS templates use inline scripts
  crossOriginEmbedderPolicy: false,
}));

// ── Body parsing ──
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Sessions ──
app.use(session({
  store: new SQLiteStore({ dir: path.join(__dirname, '..', 'data'), db: 'sessions.sqlite' }),
  secret: process.env.SESSION_SECRET || 'change-me-please-' + Date.now(),
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

// ── Static files ──
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Inject user into all templates ──
app.use(injectUser);

// ── Trust proxy (Cloudflare Tunnel) ──
app.set('trust proxy', 1);

// ── Request logging ──
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (!req.path.startsWith('/health') && !req.path.startsWith('/styles')) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms ${req.user ? req.user.email : 'anon'}`);
    }
  });
  next();
});

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
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) return next();
  const htmlPath = path.join(__dirname, '..', 'public', req.path + '.html');
  const fs = require('fs');
  if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
  const indexPath = path.join(__dirname, '..', 'public', req.path, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  next();
});

// ── Health check ──
app.get('/health', (req, res) => {
  const db = require('./db').getDb();
  const playerCount = db.prepare('SELECT COUNT(*) AS c FROM players').get().c;
  const sessionCount = db.prepare('SELECT COUNT(*) AS c FROM sessions').get().c;
  res.json({
    status: 'ok',
    playerCount, sessionCount,
    timestamp: new Date().toISOString(),
  });
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

// Daily backup at 2 AM
cron.schedule('0 2 * * *', () => {
  console.log('[Cron] Running daily backup');
  try {
    const { performBackup } = require('./services/backup-service');
    performBackup();
  } catch (e) { console.error('Cron backup error:', e); }
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
      const regs = db.prepare(`SELECT r.*, p.name, p.email FROM registrations r JOIN players p ON r.player_id = p.player_id WHERE r.session_id = ? AND r.status = 'registered'`).all(session.session_id);
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
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`D&D Session Scheduler running on http://0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
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

