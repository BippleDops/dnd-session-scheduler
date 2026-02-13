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
      map_url TEXT,
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

    -- V3 tables

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

    CREATE TABLE IF NOT EXISTS dice_rolls (
      roll_id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(session_id),
      player_id TEXT REFERENCES players(player_id),
      expression TEXT NOT NULL,
      results TEXT,
      total INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS initiative_entries (
      entry_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      name TEXT NOT NULL,
      initiative INTEGER DEFAULT 0,
      hp INTEGER,
      max_hp INTEGER,
      conditions TEXT,
      is_npc INTEGER DEFAULT 0,
      player_id TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
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

    -- V4 tables

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

    CREATE TABLE IF NOT EXISTS session_checklists (
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      recap_written INTEGER DEFAULT 0,
      attendance_confirmed INTEGER DEFAULT 0,
      characters_leveled INTEGER DEFAULT 0,
      foundry_loaded INTEGER DEFAULT 0,
      prep_reviewed INTEGER DEFAULT 0,
      loot_prepared INTEGER DEFAULT 0,
      music_set INTEGER DEFAULT 0,
      modified_at TEXT DEFAULT (datetime('now'))
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

    CREATE TABLE IF NOT EXISTS questionnaires (
      questionnaire_id TEXT PRIMARY KEY,
      campaign_id TEXT REFERENCES campaigns(campaign_id),
      title TEXT NOT NULL,
      questions TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questionnaire_responses (
      response_id TEXT PRIMARY KEY,
      questionnaire_id TEXT NOT NULL REFERENCES questionnaires(questionnaire_id),
      player_id TEXT NOT NULL REFERENCES players(player_id),
      answers TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS availability_polls (
      poll_id TEXT PRIMARY KEY,
      campaign_id TEXT REFERENCES campaigns(campaign_id),
      title TEXT NOT NULL,
      options TEXT NOT NULL,
      created_by TEXT,
      status TEXT DEFAULT 'Open' CHECK(status IN ('Open','Closed','Converted')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS availability_votes (
      vote_id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL REFERENCES availability_polls(poll_id),
      player_id TEXT NOT NULL REFERENCES players(player_id),
      selected_options TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_requests (
      request_id TEXT PRIMARY KEY,
      campaign_id TEXT REFERENCES campaigns(campaign_id),
      player_id TEXT NOT NULL REFERENCES players(player_id),
      preferred_date TEXT,
      message TEXT,
      upvotes INTEGER DEFAULT 1,
      status TEXT DEFAULT 'Open' CHECK(status IN ('Open','Converted','Closed')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_request_votes (
      request_id TEXT NOT NULL REFERENCES session_requests(request_id),
      player_id TEXT NOT NULL REFERENCES players(player_id),
      available_dates TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (request_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS world_state (
      state_id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id),
      fact TEXT NOT NULL,
      value TEXT NOT NULL,
      changed_session_id TEXT REFERENCES sessions(session_id),
      changed_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS homework_progress (
      player_id TEXT NOT NULL REFERENCES players(player_id),
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      recap_read INTEGER DEFAULT 0,
      journal_written INTEGER DEFAULT 0,
      downtime_submitted INTEGER DEFAULT 0,
      character_updated INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (player_id, session_id)
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_registrations_session ON registrations(session_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_player ON registrations(player_id);
    CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
    CREATE INDEX IF NOT EXISTS idx_admin_log_type ON admin_log(action_type);
    CREATE INDEX IF NOT EXISTS idx_admin_log_timestamp ON admin_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_characters_player ON characters(player_id);
    CREATE INDEX IF NOT EXISTS idx_loot_character ON loot(character_id);
    CREATE INDEX IF NOT EXISTS idx_loot_session ON loot(session_id);
    CREATE INDEX IF NOT EXISTS idx_dice_rolls_session ON dice_rolls(session_id);
    CREATE INDEX IF NOT EXISTS idx_initiative_session ON initiative_entries(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_player_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON campaigns(slug);
    CREATE INDEX IF NOT EXISTS idx_journals_character ON character_journals(character_id);
    CREATE INDEX IF NOT EXISTS idx_journals_player ON character_journals(player_id);
    CREATE INDEX IF NOT EXISTS idx_downtime_player ON downtime_actions(player_id);
    CREATE INDEX IF NOT EXISTS idx_downtime_status ON downtime_actions(status);
    CREATE INDEX IF NOT EXISTS idx_threads_campaign ON discussion_threads(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_posts_thread ON discussion_posts(thread_id);
    CREATE INDEX IF NOT EXISTS idx_worldstate_campaign ON world_state(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_moments_session ON session_moments(session_id);
    CREATE INDEX IF NOT EXISTS idx_homework_player ON homework_progress(player_id);

    -- Email preferences per player (opt-in/out by category)
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

    -- Email deduplication: track which emails were sent per player per session
    CREATE TABLE IF NOT EXISTS email_sent_tracker (
      player_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      email_type TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (player_id, session_id, email_type)
    );

    -- Composite indexes for frequent query patterns
    CREATE INDEX IF NOT EXISTS idx_registrations_session_status ON registrations(session_id, status);
    CREATE INDEX IF NOT EXISTS idx_registrations_player_status ON registrations(player_id, status);
    CREATE INDEX IF NOT EXISTS idx_sessions_date_status ON sessions(date, status);
    CREATE INDEX IF NOT EXISTS idx_session_history_date ON session_history(session_date);
    CREATE INDEX IF NOT EXISTS idx_notifications_player ON notifications(player_id, read);
    CREATE INDEX IF NOT EXISTS idx_session_comments_session ON session_comments(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_player_id);
    CREATE INDEX IF NOT EXISTS idx_email_log_timestamp ON email_log(timestamp);
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
    ['EMAIL_AUTO_SEND', 'TRUE', 'Send emails automatically (FALSE = draft/log only)'],
    ['DIGEST_DAY', '0', 'Day of week for weekly digest (0=Sunday, 6=Saturday)'],
    ['DIGEST_HOUR', '18', 'Hour (0-23) for weekly digest email'],
  ];

  // Versioned schema migrations
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT,
    applied_at TEXT DEFAULT (datetime('now'))
  )`);

  const appliedVersions = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version)
  );

  const migrations = [
    { version: 1, desc: 'Add player photo_url', sql: "ALTER TABLE players ADD COLUMN photo_url TEXT" },
    { version: 2, desc: 'Add player feed_token', sql: "ALTER TABLE players ADD COLUMN feed_token TEXT" },
    { version: 3, desc: 'Add session level_tier', sql: "ALTER TABLE sessions ADD COLUMN level_tier TEXT DEFAULT 'any'" },
    { version: 4, desc: 'Add campaign foundry_url', sql: "ALTER TABLE campaigns ADD COLUMN foundry_url TEXT" },
    { version: 5, desc: 'Add campaign recurring_schedule', sql: "ALTER TABLE campaigns ADD COLUMN recurring_schedule TEXT" },
    { version: 6, desc: 'Add campaign recurring_exceptions', sql: "ALTER TABLE campaigns ADD COLUMN recurring_exceptions TEXT" },
    { version: 7, desc: 'Add session map_url', sql: "ALTER TABLE sessions ADD COLUMN map_url TEXT" },
    { version: 8, desc: 'Add registration rsvp_status', sql: "ALTER TABLE registrations ADD COLUMN rsvp_status TEXT DEFAULT NULL" },
    { version: 9, desc: 'Add character goals table', sql: `CREATE TABLE IF NOT EXISTS character_goals (
      goal_id TEXT PRIMARY KEY, character_id TEXT NOT NULL REFERENCES characters(character_id),
      title TEXT NOT NULL, description TEXT, type TEXT DEFAULT 'short' CHECK(type IN ('short','long')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','abandoned')),
      reward TEXT, completed_at TEXT, created_at TEXT DEFAULT (datetime('now'))
    )` },
    { version: 10, desc: 'Add character relationships table', sql: `CREATE TABLE IF NOT EXISTS character_relationships (
      relationship_id TEXT PRIMARY KEY, character_id TEXT NOT NULL REFERENCES characters(character_id),
      target_name TEXT NOT NULL, target_type TEXT DEFAULT 'npc' CHECK(target_type IN ('npc','pc','faction','deity')),
      disposition TEXT DEFAULT 'neutral' CHECK(disposition IN ('allied','friendly','neutral','unfriendly','hostile')),
      description TEXT, created_at TEXT DEFAULT (datetime('now'))
    )` },
    { version: 11, desc: 'Add monsters table', sql: `CREATE TABLE IF NOT EXISTS monsters (
      monster_id TEXT PRIMARY KEY, name TEXT NOT NULL, size TEXT, type TEXT, alignment TEXT,
      ac INTEGER DEFAULT 10, hp INTEGER DEFAULT 1, speed TEXT,
      str INTEGER DEFAULT 10, dex INTEGER DEFAULT 10, con INTEGER DEFAULT 10,
      int_ INTEGER DEFAULT 10, wis INTEGER DEFAULT 10, cha INTEGER DEFAULT 10,
      challenge_rating REAL DEFAULT 0, xp INTEGER DEFAULT 0,
      abilities TEXT, actions TEXT, source TEXT DEFAULT 'custom',
      created_at TEXT DEFAULT (datetime('now'))
    )` },
    { version: 12, desc: 'Add NPCs table', sql: `CREATE TABLE IF NOT EXISTS npcs (
      npc_id TEXT PRIMARY KEY, campaign_id TEXT REFERENCES campaigns(campaign_id),
      name TEXT NOT NULL, description TEXT, location TEXT, disposition TEXT,
      portrait_url TEXT, voice_notes TEXT, sessions TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )` },
    { version: 13, desc: 'Add locations table', sql: `CREATE TABLE IF NOT EXISTS locations (
      location_id TEXT PRIMARY KEY, campaign_id TEXT REFERENCES campaigns(campaign_id),
      name TEXT NOT NULL, description TEXT, type TEXT, discovered_session_id TEXT,
      notes TEXT, created_at TEXT DEFAULT (datetime('now'))
    )` },
    { version: 14, desc: 'Add plot threads table', sql: `CREATE TABLE IF NOT EXISTS plot_threads (
      thread_id TEXT PRIMARY KEY, campaign_id TEXT REFERENCES campaigns(campaign_id),
      title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'active' CHECK(status IN ('active','resolved','abandoned')),
      priority TEXT DEFAULT 'normal', related_sessions TEXT,
      created_at TEXT DEFAULT (datetime('now')), resolved_at TEXT
    )` },
    { version: 15, desc: 'Add gallery table', sql: `CREATE TABLE IF NOT EXISTS gallery_items (
      item_id TEXT PRIMARY KEY, campaign_id TEXT REFERENCES campaigns(campaign_id),
      player_id TEXT REFERENCES players(player_id), type TEXT DEFAULT 'art',
      title TEXT, description TEXT, image_url TEXT NOT NULL,
      upvotes INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
    )` },
    { version: 16, desc: 'Add guest tokens table', sql: `CREATE TABLE IF NOT EXISTS guest_tokens (
      token TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(session_id),
      created_by TEXT, max_uses INTEGER DEFAULT 1, uses INTEGER DEFAULT 0,
      expires_at TEXT, created_at TEXT DEFAULT (datetime('now'))
    )` },
    { version: 17, desc: 'Add engagement scores table', sql: `CREATE TABLE IF NOT EXISTS engagement_scores (
      player_id TEXT PRIMARY KEY REFERENCES players(player_id),
      attendance_score REAL DEFAULT 0, journal_score REAL DEFAULT 0,
      downtime_score REAL DEFAULT 0, discussion_score REAL DEFAULT 0,
      overall_score REAL DEFAULT 0, updated_at TEXT DEFAULT (datetime('now'))
    )` },
  ];

  for (const m of migrations) {
    if (appliedVersions.has(m.version)) continue;
    try {
      db.exec(m.sql);
    } catch (e) {
      // Column may already exist from before versioning was added — that's OK
      if (!String(e.message).includes('duplicate column')) throw e;
    }
    db.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(m.version, m.desc);
    console.log(`[DB] Applied migration v${m.version}: ${m.desc}`);
  }

  const seedTx = db.transaction(() => {
    for (const [key, value, desc] of defaults) {
      insertConfig.run(key, value, desc);
    }
  });
  seedTx();

  // Seed campaigns from config
  const campaignList = (db.prepare("SELECT value FROM config WHERE key = 'CAMPAIGN_LIST'").get()?.value || 'Aethermoor,Aquabyssos,Terravor,Two Cities').split(',').map(c => c.trim());
  const insertCampaign = db.prepare(`INSERT OR IGNORE INTO campaigns (campaign_id, slug, name, created_at) VALUES (?, ?, ?, datetime('now'))`);
  for (const name of campaignList) {
    insertCampaign.run(generateUuid(), name.toLowerCase().replace(/\s+/g, '-'), name);
  }

  // Seed achievements
  const achievements = [
    ['first-session', 'First Quest', 'Completed your first session', '⚔️'],
    ['ten-sessions', 'Veteran Adventurer', 'Completed 10 sessions', '🛡️'],
    ['hundred-sessions', 'Living Legend', 'Completed 100 sessions', '👑'],
    ['perfect-attendance', 'Reliable Ally', 'Never missed a registered session', '⭐'],
    ['level-20', 'Epic Hero', 'Reached character level 20', '🌟'],
    ['multi-campaign', 'World Traveler', 'Played in 3+ campaigns', '🌍'],
    ['first-character', 'Character Born', 'Created your first character', '📝'],
  ];
  const insertAchievement = db.prepare(`INSERT OR IGNORE INTO achievements (achievement_id, key, name, description, icon) VALUES (?, ?, ?, ?, ?)`);
  for (const [key, name, desc, icon] of achievements) {
    insertAchievement.run(generateUuid(), key, name, desc, icon);
  }

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

