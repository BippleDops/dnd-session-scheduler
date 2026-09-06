/**
 * Secret material for cookie signing and HMAC-signed email links.
 *
 * SESSION_SECRET is mandatory in production: the process refuses to start
 * without it. In development a fixed (insecure) fallback keeps sessions stable
 * across restarts, but a loud warning is printed.
 */
const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRET = 'change-me-to-a-random-64-char-string';
const DEV_FALLBACK_SECRET = 'dev-only-insecure-session-secret-set-SESSION_SECRET-in-apps/api/.env';

function isProduction(env = process.env) {
  return env.NODE_ENV === 'production';
}

/**
 * Returns the express-session secret.
 * @throws {Error} in production when SESSION_SECRET is missing or still the env.example placeholder.
 */
function getSessionSecret(env = process.env) {
  const secret = env.SESSION_SECRET || '';
  const isPlaceholder = secret === PLACEHOLDER_SECRET;

  if (isProduction(env)) {
    if (!secret || isPlaceholder) {
      throw new Error(
        '[SECURITY] SESSION_SECRET is not set (or is still the env.example placeholder). ' +
        'Refusing to start with NODE_ENV=production. Generate one with `openssl rand -hex 32` ' +
        'and set it in the deployment environment.'
      );
    }
    if (secret.length < MIN_SECRET_LENGTH) {
      console.warn(`[SECURITY] SESSION_SECRET is shorter than ${MIN_SECRET_LENGTH} characters. Use a longer random string.`);
    }
    return secret;
  }

  if (!secret || isPlaceholder || secret.length < MIN_SECRET_LENGTH) {
    console.warn(
      '\n[SECURITY] ******************************************************************\n' +
      '[SECURITY] SESSION_SECRET is missing, too short or still the placeholder.\n' +
      '[SECURITY] Using an INSECURE development fallback. Never run like this in production.\n' +
      '[SECURITY] Set SESSION_SECRET in apps/api/.env (e.g. `openssl rand -hex 32`).\n' +
      '[SECURITY] ******************************************************************\n'
    );
  }
  return secret || DEV_FALLBACK_SECRET;
}

/**
 * Secret used to sign one-click email links (unsubscribe, RSVP).
 * Prefers UNSUBSCRIBE_SECRET so it can be rotated independently of the cookie
 * secret; otherwise derives from SESSION_SECRET (which keeps links sent before
 * this option existed valid). There is no hard-coded fallback.
 */
function getLinkSigningSecret(env = process.env) {
  return env.UNSUBSCRIBE_SECRET || getSessionSecret(env);
}

module.exports = {
  getSessionSecret,
  getLinkSigningSecret,
  MIN_SECRET_LENGTH,
  PLACEHOLDER_SECRET,
  DEV_FALLBACK_SECRET,
};
