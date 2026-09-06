/**
 * Tests for CSRF token middleware.
 */
const { generateCsrfToken, validateCsrfToken, generateCancelToken, validateCancelToken } = require('../../src/middleware/csrf');

describe('CSRF tokens', () => {
  it('generates a 64-character hex token', () => {
    const token = generateCsrfToken('session-123');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('validates a fresh token for the session it was issued to', () => {
    const token = generateCsrfToken('session-123');
    expect(validateCsrfToken(token, 'session-123')).toBe(true);
  });

  it('rejects a token presented by a different session', () => {
    const token = generateCsrfToken('session-123');
    expect(validateCsrfToken(token, 'session-456')).toBe(false);
  });

  it('rejects a token presented without a session id', () => {
    const token = generateCsrfToken('session-123');
    expect(validateCsrfToken(token)).toBe(false);
    expect(validateCsrfToken(token, '')).toBe(false);
  });

  it('consumes the token even when the session does not match', () => {
    const token = generateCsrfToken('session-123');
    validateCsrfToken(token, 'session-456');
    expect(validateCsrfToken(token, 'session-123')).toBe(false);
  });

  it('rejects a token on second use (single-use)', () => {
    const token = generateCsrfToken('session-123');
    validateCsrfToken(token, 'session-123'); // first use
    expect(validateCsrfToken(token, 'session-123')).toBe(false);
  });

  it('rejects an unknown token', () => {
    expect(validateCsrfToken('not-a-real-token', 'session-123')).toBe(false);
  });

  it('rejects non-string tokens', () => {
    expect(validateCsrfToken(undefined, 'session-123')).toBe(false);
    expect(validateCsrfToken({ toString: () => 'x' }, 'session-123')).toBe(false);
  });

  it('generates unique tokens', () => {
    const t1 = generateCsrfToken('s1');
    const t2 = generateCsrfToken('s2');
    expect(t1).not.toBe(t2);
  });
});

describe('Cancel tokens', () => {
  it('generates a 48-character hex token', () => {
    const token = generateCancelToken('reg-123');
    expect(token).toMatch(/^[0-9a-f]{48}$/);
  });

  it('validates and returns registrationId', () => {
    const token = generateCancelToken('reg-456');
    const result = validateCancelToken(token);
    expect(result).toBe('reg-456');
  });

  it('is single-use', () => {
    const token = generateCancelToken('reg-789');
    validateCancelToken(token);
    expect(validateCancelToken(token)).toBeNull();
  });

  it('rejects unknown cancel token', () => {
    expect(validateCancelToken('fake-token')).toBeNull();
  });
});
