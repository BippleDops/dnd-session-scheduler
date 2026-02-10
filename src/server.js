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
app.use('/', pageRoutes);

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

