/**
 * Tests for CSRF token middleware.
 */
const { generateCsrfToken, validateCsrfToken, generateCancelToken, validateCancelToken } = require('../../src/middleware/csrf');

describe('CSRF tokens', () => {
  it('generates a 64-character hex token', () => {
    const token = generateCsrfToken('session-123');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('validates a fresh token', () => {
    const token = generateCsrfToken('session-123');
    expect(validateCsrfToken(token)).toBe(true);
  });

  it('rejects a token on second use (single-use)', () => {
    const token = generateCsrfToken('session-123');
    validateCsrfToken(token); // first use
    expect(validateCsrfToken(token)).toBe(false);
  });

  it('rejects an unknown token', () => {
    expect(validateCsrfToken('not-a-real-token')).toBe(false);
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
