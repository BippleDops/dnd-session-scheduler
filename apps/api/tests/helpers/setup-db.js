/**
 * Test helper: provides a fresh in-memory SQLite database for each test suite.
 * Mocks the db module so all services use the test database.
 */
const Database = require('better-sqlite3');
const crypto = require('crypto');

let _testDb = null;

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  _testDb = db;
  return db;
}

function getTestDb() {
  return _testDb;
}

function closeTestDb() {
  if (_testDb) {
    _testDb.close();
    _testDb = null;
  }
}

/**
 * Initialize the test database with the full schema (mirroring db.js initializeDatabase).
 * This runs the same DDL so tests exercise real schema constraints.
 */
function initTestSchema(db) {
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
      map_url TEXT,
      co_dm TEXT,
      prep_checklist TEXT,
      calendar_event_id TEXT,
      pre_session_note TEXT,
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
      status TEXT DEFAULT 'Confirmed' CHECK(status IN ('Pending','Confirmed','Cancelled','Waitlisted','Attended','No-Show')),
      attendance_confirmed INTEGER DEFAULT 0,
      rsvp_status TEXT DEFAULT NULL
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

    CREATE TABLE IF NOT EXISTS notifications (
      notification_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(player_id),
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_id TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      campaign_id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      lore TEXT,
      house_rules TEXT,
      banner_url TEXT,
      world_map_url TEXT,
      default_tier TEXT DEFAULT 'any',
      foundry_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS characters (
      character_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(player_id),
      name TEXT NOT NULL,
      class TEXT,
      subclass TEXT,
      level INTEGER DEFAULT 1,
      race TEXT,
      backstory TEXT,
      portrait_url TEXT,
      hp INTEGER,
      max_hp INTEGER,
      ac INTEGER,
      str INTEGER DEFAULT 10,
      dex INTEGER DEFAULT 10,
      con INTEGER DEFAULT 10,
      int_ INTEGER DEFAULT 10,
      wis INTEGER DEFAULT 10,
      cha INTEGER DEFAULT 10,
      proficiencies TEXT,
      equipment TEXT,
      gold INTEGER DEFAULT 0,
      silver INTEGER DEFAULT 0,
      copper INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Retired','Dead')),
      created_at TEXT DEFAULT (datetime('now')),
      modified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS loot (
      loot_id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(session_id),
      character_id TEXT REFERENCES characters(character_id),
      item_name TEXT NOT NULL,
      description TEXT,
      rarity TEXT DEFAULT 'Common',
      quantity INTEGER DEFAULT 1,
      gold_value INTEGER DEFAULT 0,
      awarded_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS player_recaps (
      recap_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      player_id TEXT NOT NULL REFERENCES players(player_id),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      message_id TEXT PRIMARY KEY,
      from_player_id TEXT NOT NULL REFERENCES players(player_id),
      to_player_id TEXT NOT NULL REFERENCES players(player_id),
      subject TEXT,
      body TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS achievements (
      achievement_id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT
    );

    CREATE TABLE IF NOT EXISTS player_achievements (
      player_id TEXT NOT NULL REFERENCES players(player_id),
      achievement_id TEXT NOT NULL REFERENCES achievements(achievement_id),
      earned_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (player_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS session_prep (
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      previously_on TEXT,
      key_npcs TEXT,
      scenes_planned TEXT,
      secrets TEXT,
      possible_loot TEXT,
      dm_teaser TEXT,
      foundry_scene TEXT,
      map_screenshot_url TEXT,
      modified_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_moments (
      moment_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      timestamp TEXT DEFAULT (datetime('now')),
      type TEXT NOT NULL CHECK(type IN ('combat_start','combat_end','key_moment','break','loot_drop','plot_reveal','note')),
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS character_journals (
      journal_id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(character_id),
      player_id TEXT NOT NULL REFERENCES players(player_id),
      session_id TEXT REFERENCES sessions(session_id),
      title TEXT,
      content TEXT NOT NULL,
      dm_comment TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS downtime_actions (
      action_id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(character_id),
      player_id TEXT NOT NULL REFERENCES players(player_id),
      campaign_id TEXT REFERENCES campaigns(campaign_id),
      type TEXT NOT NULL CHECK(type IN ('Crafting','Training','Research','Carousing','Working','Exploring','Other')),
      description TEXT NOT NULL,
      goal TEXT,
      duration TEXT,
      status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','Resolved')),
      dm_notes TEXT,
      reward TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS discussion_threads (
      thread_id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id),
      player_id TEXT NOT NULL REFERENCES players(player_id),
      title TEXT NOT NULL,
      pinned INTEGER DEFAULT 0,
      locked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discussion_posts (
      post_id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES discussion_threads(thread_id),
      player_id TEXT NOT NULL REFERENCES players(player_id),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_preferences (
      player_id TEXT PRIMARY KEY REFERENCES players(player_id),
      reminders INTEGER DEFAULT 1,
      confirmations INTEGER DEFAULT 1,
      cancellations INTEGER DEFAULT 1,
      updates INTEGER DEFAULT 1,
      digest INTEGER DEFAULT 1,
      achievements INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_sent_tracker (
      player_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      email_type TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (player_id, session_id, email_type)
    );

    CREATE TABLE IF NOT EXISTS world_state (
      state_id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id),
      fact TEXT NOT NULL,
      value TEXT NOT NULL,
      changed_session_id TEXT REFERENCES sessions(session_id),
      changed_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT,
      applied_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_registrations_session ON registrations(session_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_player ON registrations(player_id);
    CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
    CREATE INDEX IF NOT EXISTS idx_characters_player ON characters(player_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_player ON notifications(player_id, read);
    CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON campaigns(slug);
  `);

  // Seed default config
  const insertConfig = db.prepare(`
    INSERT OR IGNORE INTO config (key, value, description, modified_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  const defaults = [
    ['MAX_PLAYERS_DEFAULT', '6', 'Default max players per session'],
    ['REMINDER_LEAD_DAYS', '1', 'Days before session to send reminders'],
    ['RECAP_FOLLOW_DAYS', '1', 'Days after session to send recap reminder'],
    ['REMINDER_TRIGGER_HOUR', '8', 'Hour (0-23) for daily trigger'],
    ['CAMPAIGN_LIST', 'Aethermoor,Aquabyssos,Terravor,Two Cities', 'Available campaigns'],
    ['EMAIL_DAILY_COUNT', '0', 'Emails sent today (auto-reset)'],
    ['EMAIL_DAILY_LIMIT', '100', 'Max emails per day'],
    ['FEATURE_WAITLIST', 'FALSE', 'Enable waitlist when sessions are full'],
    ['FEATURE_PLAYER_CANCEL', 'TRUE', 'Allow players to self-cancel registrations'],
  ];
  for (const [key, value, desc] of defaults) {
    insertConfig.run(key, value, desc);
  }
}

/**
 * Helper to insert a test player directly.
 */
function insertTestPlayer(db, overrides = {}) {
  const id = overrides.player_id || crypto.randomUUID();
  const email = overrides.email || `player-${id.slice(0, 8)}@test.com`;
  db.prepare(`
    INSERT INTO players (player_id, name, email, played_before, active_status, registered_at)
    VALUES (?, ?, ?, ?, 'Active', datetime('now'))
  `).run(id, overrides.name || 'Test Player', email, overrides.played_before || 'yes');
  return { player_id: id, email, name: overrides.name || 'Test Player' };
}

/**
 * Helper to insert a test session directly.
 */
function insertTestSession(db, overrides = {}) {
  const id = overrides.session_id || crypto.randomUUID();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  const date = overrides.date || futureDate.toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO sessions (session_id, date, start_time, duration, end_time, status, max_players,
      campaign, title, description, level_tier, location, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    id, date,
    overrides.start_time || '18:00',
    overrides.duration || 4,
    overrides.end_time || '22:00',
    overrides.status || 'Scheduled',
    overrides.max_players || 6,
    overrides.campaign || 'Aethermoor',
    overrides.title || 'Test Session',
    overrides.description || 'A test session',
    overrides.level_tier || 'any',
    overrides.location || 'Online',
  );
  return { session_id: id, date, campaign: overrides.campaign || 'Aethermoor' };
}

/**
 * Helper to insert a test registration directly.
 */
function insertTestRegistration(db, sessionId, playerId, overrides = {}) {
  const id = overrides.registration_id || crypto.randomUUID();
  db.prepare(`
    INSERT INTO registrations (registration_id, session_id, player_id,
      char_name_snapshot, class_snapshot, level_snapshot, race_snapshot, status, signup_timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    id, sessionId, playerId,
    overrides.char_name || 'Thorn',
    overrides.char_class || 'Fighter',
    overrides.level || 5,
    overrides.race || 'Human',
    overrides.status || 'Confirmed',
  );
  return { registration_id: id };
}

/**
 * Sets up the db mock for a test suite. Call in beforeEach.
 * Returns the test database instance.
 */
function setupDbMock() {
  const db = createTestDb();
  initTestSchema(db);

  // Use jest.doMock (not hoisted) so we can reference the local `db` variable
  jest.doMock('../../src/db', () => {
    const original = jest.requireActual('../../src/db');
    return {
      ...original,
      getDb: () => db,
      getConfigValue: (key, defaultValue = '') => {
        const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
        return row ? row.value : defaultValue;
      },
      setConfigValue: (key, value) => {
        db.prepare(`
          INSERT INTO config (key, value, modified_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = ?, modified_at = datetime('now')
        `).run(key, value, value);
      },
      getAllConfigValues: () => {
        return db.prepare('SELECT key, value, description, modified_at FROM config ORDER BY key').all();
      },
      logAction: (actionType, details, triggeredBy, relatedId = '') => {
        const maskedBy = original.maskEmail(triggeredBy || '');
        db.prepare(`
          INSERT INTO admin_log (log_id, timestamp, action_type, details, triggered_by, related_id)
          VALUES (?, datetime('now'), ?, ?, ?, ?)
        `).run(original.generateUuid(), actionType, details, maskedBy, relatedId);
      },
    };
  });

  return db;
}

module.exports = {
  createTestDb,
  getTestDb,
  closeTestDb,
  initTestSchema,
  insertTestPlayer,
  insertTestSession,
  insertTestRegistration,
  setupDbMock,
};
