/**
 * Tests for signup rate limiting.
 */
const { checkRateLimit } = require('../../src/middleware/rate-limit');

describe('checkRateLimit', () => {
  it('allows the first attempt', () => {
    const result = checkRateLimit(`unique-${Date.now()}@test.com`);
    expect(result.allowed).toBe(true);
  });

  it('allows up to 5 attempts', () => {
    const email = `ratelimit-${Date.now()}@test.com`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(email).allowed).toBe(true);
    }
  });

  it('blocks the 6th attempt', () => {
    const email = `blocked-${Date.now()}@test.com`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(email);
    }
    const result = checkRateLimit(email);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('Too many');
  });

  it('is case-insensitive', () => {
    const base = `case-${Date.now()}@test.com`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(base.toUpperCase());
    }
    const result = checkRateLimit(base.toLowerCase());
    expect(result.allowed).toBe(false);
  });

  it('allows null/empty email', () => {
    expect(checkRateLimit(null).allowed).toBe(true);
    expect(checkRateLimit('').allowed).toBe(true);
  });
});
