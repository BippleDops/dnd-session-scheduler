/**
 * Tests for the better-sqlite3-backed express-session store.
 */
const http = require('http');
const Database = require('better-sqlite3');
const express = require('express');
const session = require('express-session');

const {
  BetterSqliteSessionStore,
  expiryFor,
  DEFAULT_TABLE,
  ONE_DAY_MS,
} = require('../../src/config/session-store');

const HOUR_MS = 60 * 60 * 1000;

function promisify(store, method, ...args) {
  return new Promise((resolve, reject) => {
    store[method](...args, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

describe('expiryFor', () => {
  const now = 1_700_000_000_000;

  test('prefers an explicit cookie.expires', () => {
    const expires = new Date(now + 5 * HOUR_MS);
    expect(expiryFor({ cookie: { expires, maxAge: HOUR_MS } }, now)).toBe(now + 5 * HOUR_MS);
    expect(expiryFor({ cookie: { expires: expires.toISOString() } }, now)).toBe(now + 5 * HOUR_MS);
  });

  test('falls back to maxAge, then to one day', () => {
    expect(expiryFor({ cookie: { maxAge: HOUR_MS } }, now)).toBe(now + HOUR_MS);
    expect(expiryFor({ cookie: {} }, now)).toBe(now + ONE_DAY_MS);
    expect(expiryFor({}, now)).toBe(now + ONE_DAY_MS);
    expect(expiryFor({ cookie: { expires: 'not a date' } }, now)).toBe(now + ONE_DAY_MS);
  });
});

describe('BetterSqliteSessionStore', () => {
  let db;
  let store;

  beforeEach(() => {
    db = new Database(':memory:');
    store = new BetterSqliteSessionStore({ db, cleanupIntervalMs: 0 });
  });

  afterEach(() => {
    store.close();
    db.close();
  });

  test('requires a better-sqlite3 database and a safe table name', () => {
    expect(() => new BetterSqliteSessionStore()).toThrow(/requires a better-sqlite3/);
    expect(() => new BetterSqliteSessionStore({ db: {} })).toThrow(/requires a better-sqlite3/);
    expect(() => new BetterSqliteSessionStore({ db, table: 'bad name; DROP TABLE x' })).toThrow(/Invalid session table name/);
  });

  test('creates its table without touching the app "sessions" table', () => {
    // The game-session table that the store must never collide with.
    db.exec('CREATE TABLE IF NOT EXISTS sessions (session_id TEXT PRIMARY KEY, date TEXT)');
    const other = new BetterSqliteSessionStore({ db, cleanupIntervalMs: 0 });
    other.close();

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['sessions', DEFAULT_TABLE]));
    const cols = db.prepare(`PRAGMA table_info(${DEFAULT_TABLE})`).all().map((c) => c.name);
    expect(cols).toEqual(['sid', 'sess', 'expires_at']);
  });

  test('set/get round-trips a session and returns null for unknown ids', async () => {
    const sess = { cookie: { maxAge: HOUR_MS }, passport: { user: 'abc' }, count: 1 };
    await promisify(store, 'set', 'sid-1', sess);

    expect(await promisify(store, 'get', 'sid-1')).toEqual(sess);
    expect(await promisify(store, 'get', 'missing')).toBeNull();
  });

  test('set overwrites an existing session in place', async () => {
    await promisify(store, 'set', 'sid-1', { cookie: { maxAge: HOUR_MS }, n: 1 });
    await promisify(store, 'set', 'sid-1', { cookie: { maxAge: HOUR_MS }, n: 2 });

    expect(await promisify(store, 'get', 'sid-1')).toEqual({ cookie: { maxAge: HOUR_MS }, n: 2 });
    expect(await promisify(store, 'length')).toBe(1);
  });

  test('expired sessions are invisible and purged', async () => {
    await promisify(store, 'set', 'live', { cookie: { maxAge: HOUR_MS } });
    await promisify(store, 'set', 'dead', { cookie: { expires: new Date(Date.now() - 1000) } });

    expect(await promisify(store, 'get', 'dead')).toBeNull();
    expect(await promisify(store, 'length')).toBe(1);
    expect(await promisify(store, 'all')).toEqual([{ cookie: { maxAge: HOUR_MS } }]);

    expect(store.purgeExpired()).toBe(1);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM ${DEFAULT_TABLE}`).get().n).toBe(1);
  });

  test('touch extends the expiry of an existing session', async () => {
    await promisify(store, 'set', 'sid-1', { cookie: { maxAge: HOUR_MS } });
    const before = db.prepare(`SELECT expires_at FROM ${DEFAULT_TABLE} WHERE sid = ?`).get('sid-1').expires_at;

    await promisify(store, 'touch', 'sid-1', { cookie: { expires: new Date(Date.now() + 10 * HOUR_MS) } });
    const after = db.prepare(`SELECT expires_at FROM ${DEFAULT_TABLE} WHERE sid = ?`).get('sid-1').expires_at;

    expect(after).toBeGreaterThan(before);
  });

  test('destroy and clear remove sessions', async () => {
    await promisify(store, 'set', 'a', { cookie: {} });
    await promisify(store, 'set', 'b', { cookie: {} });

    await promisify(store, 'destroy', 'a');
    expect(await promisify(store, 'get', 'a')).toBeNull();
    expect(await promisify(store, 'length')).toBe(1);

    await promisify(store, 'clear');
    expect(await promisify(store, 'length')).toBe(0);
  });

  test('reports storage errors through the callback instead of throwing', async () => {
    db.exec(`DROP TABLE ${DEFAULT_TABLE}`);
    await expect(promisify(store, 'set', 'sid', { cookie: {} })).rejects.toThrow(/no such table/);
    await expect(promisify(store, 'get', 'sid')).rejects.toThrow(/no such table/);
  });

  test('cleanup timer is unref-ed so it cannot keep the process alive', () => {
    const timed = new BetterSqliteSessionStore({ db, table: 'timed_sessions', cleanupIntervalMs: 60_000 });
    expect(timed.timer).not.toBeNull();
    expect(timed.timer.hasRef()).toBe(false);
    timed.close();
    expect(timed.timer).toBeNull();
  });
});

describe('BetterSqliteSessionStore with the real express-session middleware', () => {
  let db;
  let store;
  let server;
  let baseUrl;

  function request(path, headers = {}) {
    return new Promise((resolve, reject) => {
      http.get(`${baseUrl}${path}`, { headers }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) }));
      }).on('error', reject);
    });
  }

  beforeAll((done) => {
    db = new Database(':memory:');
    store = new BetterSqliteSessionStore({ db, cleanupIntervalMs: 0 });

    const app = express();
    app.use(session({
      store,
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: HOUR_MS },
    }));
    app.get('/count', (req, res) => {
      req.session.count = (req.session.count || 0) + 1;
      res.json({ count: req.session.count });
    });
    app.get('/logout', (req, res) => {
      req.session.destroy(() => res.json({ ok: true }));
    });

    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  afterAll((done) => {
    store.close();
    db.close();
    server.close(done);
  });

  test('persists session state across requests and destroys it on logout', async () => {
    const first = await request('/count');
    expect(first.body).toEqual({ count: 1 });
    const cookie = first.headers['set-cookie'][0].split(';')[0];
    expect(cookie).toMatch(/^connect\.sid=/);

    const second = await request('/count', { cookie });
    expect(second.body).toEqual({ count: 2 });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM ${DEFAULT_TABLE}`).get().n).toBe(1);

    await request('/logout', { cookie });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM ${DEFAULT_TABLE}`).get().n).toBe(0);

    const afterLogout = await request('/count', { cookie });
    expect(afterLogout.body).toEqual({ count: 1 });
  });
});
