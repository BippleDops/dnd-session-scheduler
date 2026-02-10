/**
 * Rate limiting for signup attempts.
 * Replaces GAS CacheService-based rate limiting.
 */

// In-memory rate limit store
const attempts = new Map();

/**
 * Checks if an email has exceeded the signup rate limit.
 * @param {string} email
 * @returns {{ allowed: boolean, message?: string }}
 */
function checkRateLimit(email) {
  if (!email) return { allowed: true };
  const key = email.toLowerCase().trim();
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxAttempts = 5;

  const entry = attempts.get(key);
  if (!entry || now - entry.firstAttempt > windowMs) {
    attempts.set(key, { count: 1, firstAttempt: now });
    return { allowed: true };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, message: 'Too many sign-up attempts. Please wait a few minutes and try again.' };
  }

  entry.count++;
  return { allowed: true };
}

// Prune old entries every 15 minutes
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of attempts) {
    if (v.firstAttempt < cutoff) attempts.delete(k);
  }
}, 15 * 60 * 1000);

module.exports = { checkRateLimit };

