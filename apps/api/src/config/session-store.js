/**
 * express-session store backed by the app's existing better-sqlite3 database.
 *
 * Replaces connect-sqlite3, which depended on the `sqlite3` native driver and its
 * vulnerable build toolchain (tar, node-gyp, cacache, ...). Sessions live in an
 * `http_sessions` table inside scheduler.db, so a single database file holds all
 * state and the daily backup covers logins too.
 *
 * Callbacks are invoked synchronously; express-session handles that case explicitly.
 */
const { Store } = require('express-session');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_TABLE = 'http_sessions';
const TABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Absolute expiry (ms since epoch) for a session, derived from its cookie settings. */
function expiryFor(sess, now = Date.now()) {
  const cookie = sess && sess.cookie;
  if (cookie && cookie.expires) {
    const t = new Date(cookie.expires).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (cookie && typeof cookie.maxAge === 'number') return now + cookie.maxAge;
  return now + ONE_DAY_MS;
}

class BetterSqliteSessionStore extends Store {
  /**
   * @param {object} options
   * @param {import('better-sqlite3').Database} options.db  Open better-sqlite3 database.
   * @param {string} [options.table]  Table name (default `http_sessions`).
   * @param {number} [options.cleanupIntervalMs]  How often expired rows are purged; 0 disables the timer.
   */
  constructor({ db, table = DEFAULT_TABLE, cleanupIntervalMs = DEFAULT_CLEANUP_INTERVAL_MS } = {}) {
    super();
    if (!db || typeof db.prepare !== 'function') {
      throw new TypeError('BetterSqliteSessionStore requires a better-sqlite3 Database instance (`db`)');
    }
    if (!TABLE_NAME_RE.test(table)) {
      throw new TypeError(`Invalid session table name: ${table}`);
    }
    this.db = db;
    this.table = table;

    db.exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${table}_expires_at ON ${table}(expires_at);
    `);

    this.stmts = {
      get: db.prepare(`SELECT sess FROM ${table} WHERE sid = ? AND expires_at > ?`),
      set: db.prepare(`
        INSERT INTO ${table} (sid, sess, expires_at) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at
      `),
      touch: db.prepare(`UPDATE ${table} SET expires_at = ? WHERE sid = ?`),
      destroy: db.prepare(`DELETE FROM ${table} WHERE sid = ?`),
      clear: db.prepare(`DELETE FROM ${table}`),
      length: db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE expires_at > ?`),
      all: db.prepare(`SELECT sess FROM ${table} WHERE expires_at > ?`),
      purge: db.prepare(`DELETE FROM ${table} WHERE expires_at <= ?`),
    };

    this.timer = null;
    if (cleanupIntervalMs > 0) {
      this.timer = setInterval(() => this.purgeExpired(), cleanupIntervalMs);
      if (typeof this.timer.unref === 'function') this.timer.unref();
    }
  }

  get(sid, cb) {
    this._run(cb, () => {
      const row = this.stmts.get.get(sid, Date.now());
      return row ? JSON.parse(row.sess) : null;
    });
  }

  set(sid, sess, cb) {
    this._run(cb, () => { this.stmts.set.run(sid, JSON.stringify(sess), expiryFor(sess)); });
  }

  touch(sid, sess, cb) {
    this._run(cb, () => { this.stmts.touch.run(expiryFor(sess), sid); });
  }

  destroy(sid, cb) {
    this._run(cb, () => { this.stmts.destroy.run(sid); });
  }

  clear(cb) {
    this._run(cb, () => { this.stmts.clear.run(); });
  }

  length(cb) {
    this._run(cb, () => this.stmts.length.get(Date.now()).n);
  }

  all(cb) {
    this._run(cb, () => this.stmts.all.all(Date.now()).map((r) => JSON.parse(r.sess)));
  }

  /** Deletes expired rows. Returns the number removed. */
  purgeExpired(now = Date.now()) {
    try {
      return this.stmts.purge.run(now).changes;
    } catch (err) {
      console.error('[SessionStore] Failed to purge expired sessions:', err.message);
      return 0;
    }
  }

  /** Stops the cleanup timer. The database handle is owned by the caller and is not closed. */
  close() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  _run(cb, fn) {
    let result;
    try {
      result = fn();
    } catch (err) {
      if (cb) cb(err);
      return;
    }
    if (cb) cb(null, result);
  }
}

module.exports = { BetterSqliteSessionStore, expiryFor, DEFAULT_TABLE, ONE_DAY_MS };
