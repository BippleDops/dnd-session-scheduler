/**
 * SQLite database setup and schema management.
 * Replaces Google Sheets as the data store.
 */
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'scheduler.db');
let _db = null;

function getDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');
  return _db;
}

/** Run all schema migrations. */
function initializeDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      day_type TEXT,
      start_time TEXT,
      duration INTEGER DEFAULT 4,
      end_time TEXT,
      status TEXT DEFAULT 'Scheduled' CHECK(status IN ('Scheduled','Completed','Cancelled')),
      max_players INTEGER DEFAULT 6,
      campaign TEXT,
      title TEXT,
      description TEXT,
      dm_notes TEXT,
      signup_deadline TEXT,
      location TEXT,
      tags TEXT,
      difficulty TEXT,
      level_tier TEXT DEFAULT 'any',
      co_dm TEXT,
      prep_checklist TEXT,
      calendar_event_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      modified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS players (
      player_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      photo_url TEXT,
      pronouns TEXT,
      preferred_campaign TEXT,
      preferred_times TEXT,
      accessibility_needs TEXT,
      emergency_contact TEXT,
      dm_notes TEXT,
      played_before TEXT,
      feed_token TEXT,
      registered_at TEXT DEFAULT (datetime('now')),
      active_status TEXT DEFAULT 'Active' CHECK(active_status IN ('Active','Inactive')),
      modified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS registrations (
      registration_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      player_id TEXT NOT NULL REFERENCES players(player_id),
      char_name_snapshot TEXT,
      class_snapshot TEXT,
      subclass_snapshot TEXT,
      level_snapshot INTEGER,
      race_snapshot TEXT,
      player_notes TEXT,
      admin_notes TEXT,
      signup_timestamp TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'Confirmed' CHECK(status IN ('Confirmed','Cancelled','Waitlisted','Attended','No-Show')),
      attendance_confirmed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_history (
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      session_date TEXT,
      campaign TEXT,
      attendee_char_names TEXT,
      attendee_count INTEGER DEFAULT 0,
      recap_drafted INTEGER DEFAULT 0,
      info_sheet_drafted INTEGER DEFAULT 0,
      dm_post_notes TEXT,
      xp_awarded TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      modified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_log (
      log_id TEXT PRIMARY KEY,
      timestamp TEXT DEFAULT (datetime('now')),
      action_type TEXT NOT NULL,
      details TEXT,
      triggered_by TEXT,
      related_id TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT,
      description TEXT,
      modified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS email_log (
      log_id TEXT PRIMARY KEY,
      timestamp TEXT DEFAULT (datetime('now')),
      type TEXT,
      recipient TEXT,
      subject TEXT,
      status TEXT,
      related_id TEXT
    );

    CREATE TABLE IF NOT EXISTS session_comments (
      comment_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      player_id TEXT NOT NULL REFERENCES players(player_id),
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      notification_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(player_id),
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_id TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_registrations_session ON registrations(session_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_player ON registrations(player_id);
    CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
    CREATE INDEX IF NOT EXISTS idx_admin_log_type ON admin_log(action_type);
    CREATE INDEX IF NOT EXISTS idx_admin_log_timestamp ON admin_log(timestamp);
  `);

  // Seed default config values
  const insertConfig = db.prepare(`
    INSERT OR IGNORE INTO config (key, value, description, modified_at)
    VALUES (?, ?, ?, datetime('now'))
  `);

  const defaults = [
    ['MAX_PLAYERS_DEFAULT', '6', 'Default max players per session'],
    ['REMINDER_LEAD_DAYS', '2', 'Days before session to send reminders'],
    ['RECAP_FOLLOW_DAYS', '1', 'Days after session to send recap reminder'],
    ['REMINDER_TRIGGER_HOUR', '8', 'Hour (0-23) for daily trigger'],
    ['CAMPAIGN_LIST', 'Aethermoor,Aquabyssos,Terravor,Two Cities', 'Available campaigns'],
    ['EMAIL_DAILY_COUNT', '0', 'Emails sent today (auto-reset)'],
    ['EMAIL_DAILY_LIMIT', '100', 'Max emails per day'],
    ['APP_TITLE', 'D&D Session Scheduler', 'Web app display title'],
    ['ARCHIVE_AFTER_DAYS', '365', 'Days before archiving completed sessions'],
    ['FEATURE_WAITLIST', 'FALSE', 'Enable waitlist when sessions are full'],
    ['FEATURE_PLAYER_CANCEL', 'TRUE', 'Allow players to self-cancel registrations'],
  ];

  // Schema migrations for existing databases
  const migrations = [
    "ALTER TABLE players ADD COLUMN photo_url TEXT",
    "ALTER TABLE players ADD COLUMN feed_token TEXT",
    "ALTER TABLE sessions ADD COLUMN level_tier TEXT DEFAULT 'any'",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (e) { /* column already exists */ }
  }

  const seedTx = db.transaction(() => {
    for (const [key, value, desc] of defaults) {
      insertConfig.run(key, value, desc);
    }
  });
  seedTx();

  return db;
}

// ── Helper functions (replace SheetUtils.gs) ──

function generateUuid() {
  return crypto.randomUUID();
}

function nowTimestamp() {
  return new Date().toISOString();
}

function getConfigValue(key, defaultValue = '') {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setConfigValue(key, value) {
  const db = getDb();
  db.prepare(`
    INSERT INTO config (key, value, modified_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = ?, modified_at = datetime('now')
  `).run(key, value, value);
}

function getAllConfigValues() {
  const db = getDb();
  return db.prepare('SELECT key, value, description, modified_at FROM config ORDER BY key').all();
}

function logAction(actionType, details, triggeredBy, relatedId = '') {
  const db = getDb();
  const maskedBy = maskEmail(triggeredBy || '');
  db.prepare(`
    INSERT INTO admin_log (log_id, timestamp, action_type, details, triggered_by, related_id)
    VALUES (?, datetime('now'), ?, ?, ?, ?)
  `).run(generateUuid(), actionType, details, maskedBy, relatedId);
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || 'System';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return local[0] + '***@' + domain;
  return local[0] + '***' + local[local.length - 1] + '@' + domain;
}

/** Normalize date values to YYYY-MM-DD. */
function normalizeDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return str;
}

/** Normalize time values to HH:MM. */
function normalizeTime(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    const h = val.getHours();
    const m = val.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  const str = String(val);
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(':');
    const hh = parseInt(parts[0], 10);
    return (hh < 10 ? '0' : '') + hh + ':' + parts[1];
  }
  return str;
}

module.exports = {
  getDb,
  initializeDatabase,
  generateUuid,
  nowTimestamp,
  getConfigValue,
  setConfigValue,
  getAllConfigValues,
  logAction,
  maskEmail,
  normalizeDate,
  normalizeTime,
};

