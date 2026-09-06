/**
 * Tests for initializeDatabase(): schema creation and versioned migrations.
 * Runs against an in-memory database (DB_PATH=:memory:).
 */
let logSpy;

function freshDbModule(env = {}) {
  jest.resetModules();
  process.env.DB_PATH = ':memory:';
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  return require('../../src/db');
}

function columns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
}

function appliedVersions(db) {
  return db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(r => r.version);
}

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  delete process.env.DB_PATH;
  delete process.env.INITIAL_CAMPAIGNS;
});

describe('initializeDatabase on a fresh database', () => {
  it('creates the full schema and records every migration version in ascending order', () => {
    const { initializeDatabase, getDb } = freshDbModule();
    initializeDatabase();
    const db = getDb();

    const versions = appliedVersions(db);
    expect(versions).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));

    expect(columns(db, 'sessions')).toEqual(expect.arrayContaining(['level_tier', 'map_url', 'pre_session_note']));
    expect(columns(db, 'players')).toEqual(expect.arrayContaining(['photo_url', 'feed_token']));
    expect(columns(db, 'campaigns')).toEqual(expect.arrayContaining(['foundry_url', 'recurring_schedule', 'recurring_exceptions']));
    expect(columns(db, 'registrations')).toContain('rsvp_status');
    expect(columns(db, 'engagement_scores')).toContain('overall_score');
    expect(columns(db, 'guest_tokens')).toContain('token');
    db.close();
  });

  it('is idempotent', () => {
    const { initializeDatabase, getDb } = freshDbModule();
    initializeDatabase();
    expect(() => initializeDatabase()).not.toThrow();
    expect(appliedVersions(getDb())).toHaveLength(18);
    getDb().close();
  });

  it('seeds no campaigns unless INITIAL_CAMPAIGNS is set', () => {
    const { initializeDatabase, getDb } = freshDbModule({ INITIAL_CAMPAIGNS: '' });
    initializeDatabase();
    const db = getDb();
    expect(db.prepare('SELECT COUNT(*) AS c FROM campaigns').get().c).toBe(0);
    expect(db.prepare("SELECT value FROM config WHERE key = 'CAMPAIGN_LIST'").get().value).toBe('');
    db.close();
  });

  it('seeds campaigns from INITIAL_CAMPAIGNS (comma-separated, trimmed)', () => {
    const { initializeDatabase, getDb } = freshDbModule({ INITIAL_CAMPAIGNS: ' Aethermoor, Two Cities ,, ' });
    initializeDatabase();
    const db = getDb();
    const rows = db.prepare('SELECT slug, name FROM campaigns ORDER BY name').all();
    expect(rows).toEqual([
      { slug: 'aethermoor', name: 'Aethermoor' },
      { slug: 'two-cities', name: 'Two Cities' },
    ]);
    expect(db.prepare("SELECT value FROM config WHERE key = 'CAMPAIGN_LIST'").get().value).toBe('Aethermoor,Two Cities');
    db.close();
  });

  it('accepts Pending registrations (the status processSignup writes)', () => {
    const { initializeDatabase, getDb } = freshDbModule();
    initializeDatabase();
    const db = getDb();
    db.prepare("INSERT INTO players (player_id, name, email) VALUES ('p1', 'P', 'p@test.com')").run();
    db.prepare("INSERT INTO sessions (session_id, date) VALUES ('s1', '2030-01-01')").run();
    expect(() => db.prepare("INSERT INTO registrations (registration_id, session_id, player_id, status) VALUES ('r1', 's1', 'p1', 'Pending')").run()).not.toThrow();
    db.close();
  });
});

describe('initializeDatabase on a legacy database', () => {
  it('adds columns that pre-date the CREATE TABLE definitions', () => {
    const { initializeDatabase, getDb } = freshDbModule();
    const db = getDb();
    // Simulate a campaigns table created before foundry_url / recurring_* existed
    db.exec(`CREATE TABLE campaigns (
      campaign_id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      description TEXT, lore TEXT, house_rules TEXT, banner_url TEXT, world_map_url TEXT,
      default_tier TEXT DEFAULT 'any', created_at TEXT DEFAULT (datetime('now'))
    )`);
    expect(columns(db, 'campaigns')).not.toContain('foundry_url');

    initializeDatabase();

    expect(columns(db, 'campaigns')).toEqual(expect.arrayContaining(['foundry_url', 'recurring_schedule', 'recurring_exceptions']));
    expect(appliedVersions(db)).toEqual(expect.arrayContaining([4, 5, 6]));
    db.close();
  });

  it('does not fail when a column already exists but its migration was never recorded', () => {
    const { initializeDatabase, getDb } = freshDbModule();
    const db = getDb();
    // Pre-versioning database: the column is present, schema_migrations is empty
    db.exec(`CREATE TABLE players (
      player_id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      photo_url TEXT, feed_token TEXT, registered_at TEXT DEFAULT (datetime('now')),
      active_status TEXT DEFAULT 'Active', modified_at TEXT
    )`);

    expect(() => initializeDatabase()).not.toThrow();
    expect(appliedVersions(db)).toEqual(expect.arrayContaining([1, 2]));
    expect(columns(db, 'players').filter(c => c === 'photo_url')).toHaveLength(1);
    db.close();
  });
});
