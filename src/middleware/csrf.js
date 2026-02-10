/**
 * CSRF protection using per-session tokens.
 * Replaces GAS CacheService-based CSRF tokens.
 */
const crypto = require('crypto');

// In-memory token store (tokens expire after 30 min)
const tokens = new Map();

function generateCsrfToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { sessionId, createdAt: Date.now() });
  // Prune old tokens
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [k, v] of tokens) {
    if (v.createdAt < cutoff) tokens.delete(k);
  }
  return token;
}

function validateCsrfToken(token) {
  const entry = tokens.get(token);
  if (!entry) return false;
  tokens.delete(token); // single-use
  return Date.now() - entry.createdAt < 30 * 60 * 1000;
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

