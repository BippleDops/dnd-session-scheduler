/**
 * CSRF protection using per-session tokens.
 * Replaces GAS CacheService-based CSRF tokens.
 */
const crypto = require('crypto');

// In-memory token store (tokens expire after 30 min)
const tokens = new Map();
const CSRF_TTL_MS = 30 * 60 * 1000;

function generateCsrfToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { sessionId: sessionId || '', createdAt: Date.now() });
  // Prune old tokens
  const cutoff = Date.now() - CSRF_TTL_MS;
  for (const [k, v] of tokens) {
    if (v.createdAt < cutoff) tokens.delete(k);
  }
  return token;
}

/**
 * Validates and consumes a CSRF token. The token must be redeemed by the same
 * browser session (req.sessionID) it was issued to.
 */
function validateCsrfToken(token, sessionId) {
  if (typeof token !== 'string' || !token) return false;
  const entry = tokens.get(token);
  if (!entry) return false;
  tokens.delete(token); // single-use
  if (Date.now() - entry.createdAt >= CSRF_TTL_MS) return false;
  return entry.sessionId === (sessionId || '');
}

/** Generates a one-time cancel token stored in-memory. */
function generateCancelToken(registrationId) {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set('cancel_' + token, { registrationId, createdAt: Date.now() });
  return token;
}

function validateCancelToken(token) {
  const entry = tokens.get('cancel_' + token);
  if (!entry) return null;
  tokens.delete('cancel_' + token);
  if (Date.now() - entry.createdAt > 48 * 60 * 60 * 1000) return null; // 48h expiry
  return entry.registrationId;
}

module.exports = { generateCsrfToken, validateCsrfToken, generateCancelToken, validateCancelToken };

