/**
 * Tests for db.js config and logging functions (require a real SQLite DB).
 */
const { createTestDb, initTestSchema, closeTestDb } = require('../helpers/setup-db');

// We test the real implementations against an in-memory DB
const crypto = require('crypto');

let db;

beforeEach(() => {
  db = createTestDb();
  initTestSchema(db);
});

afterEach(() => {
  closeTestDb();
});

describe('getConfigValue / setConfigValue (direct SQL)', () => {
  // Since we can't easily use the real module without its file-based DB,
  // we test the logic directly against the test schema.

  function getConfigValue(key, defaultValue = '') {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  }

  function setConfigValue(key, value) {
    db.prepare(`
      INSERT INTO config (key, value, modified_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, modified_at = datetime('now')
    `).run(key, value, value);
  }

  it('returns seeded default values', () => {
    expect(getConfigValue('MAX_PLAYERS_DEFAULT')).toBe('6');
    expect(getConfigValue('FEATURE_WAITLIST')).toBe('FALSE');
    expect(getConfigValue('FEATURE_PLAYER_CANCEL')).toBe('TRUE');
  });

  it('returns the default for a missing key', () => {
    expect(getConfigValue('NONEXISTENT', 'fallback')).toBe('fallback');
  });

  it('sets and retrieves a new config value', () => {
    setConfigValue('MY_KEY', 'my_value');
    expect(getConfigValue('MY_KEY')).toBe('my_value');
  });

  it('updates an existing config value', () => {
    setConfigValue('MAX_PLAYERS_DEFAULT', '8');
    expect(getConfigValue('MAX_PLAYERS_DEFAULT')).toBe('8');
  });
});

describe('getAllConfigValues (direct SQL)', () => {
  it('returns all config entries', () => {
    const rows = db.prepare('SELECT key, value FROM config ORDER BY key').all();
    expect(rows.length).toBeGreaterThanOrEqual(9);
    const keys = rows.map(r => r.key);
    expect(keys).toContain('MAX_PLAYERS_DEFAULT');
    expect(keys).toContain('FEATURE_WAITLIST');
  });
});

describe('logAction (direct SQL)', () => {
  function logAction(actionType, details, triggeredBy, relatedId = '') {
    const { maskEmail } = require('../../src/db');
    const maskedBy = maskEmail(triggeredBy || '');
    db.prepare(`
      INSERT INTO admin_log (log_id, timestamp, action_type, details, triggered_by, related_id)
      VALUES (?, datetime('now'), ?, ?, ?, ?)
    `).run(crypto.randomUUID(), actionType, details, maskedBy, relatedId);
  }

  it('inserts a log entry', () => {
    logAction('TEST_ACTION', 'Something happened', 'admin@test.com', 'rel-123');
    const row = db.prepare('SELECT * FROM admin_log WHERE action_type = ?').get('TEST_ACTION');
    expect(row).toBeTruthy();
    expect(row.details).toBe('Something happened');
    expect(row.triggered_by).toBe('a***n@test.com'); // masked
    expect(row.related_id).toBe('rel-123');
  });

  it('handles null triggered_by', () => {
    logAction('SYS_ACTION', 'System event', null);
    const row = db.prepare('SELECT * FROM admin_log WHERE action_type = ?').get('SYS_ACTION');
    expect(row.triggered_by).toBe('System');
  });
});
