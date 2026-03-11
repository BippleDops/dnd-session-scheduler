/**
 * Tests for db.js pure utility functions (no DB dependency).
 */
const { maskEmail, normalizeDate, normalizeTime, generateUuid, nowTimestamp } = require('../../src/db');

describe('generateUuid', () => {
  it('returns a valid UUID string', () => {
    const id = generateUuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateUuid()));
    expect(ids.size).toBe(100);
  });
});

describe('nowTimestamp', () => {
  it('returns an ISO 8601 string', () => {
    const ts = nowTimestamp();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it('is close to current time', () => {
    const before = Date.now();
    const ts = nowTimestamp();
    const after = Date.now();
    const tsMs = new Date(ts).getTime();
    expect(tsMs).toBeGreaterThanOrEqual(before);
    expect(tsMs).toBeLessThanOrEqual(after);
  });
});

describe('maskEmail', () => {
  it('masks a normal email', () => {
    expect(maskEmail('john.doe@gmail.com')).toBe('j***e@gmail.com');
  });

  it('masks a short local part (2 chars)', () => {
    // local.length <= 2 uses short-path: first char + *** + @domain
    expect(maskEmail('ab@test.com')).toBe('a***@test.com');
  });

  it('masks a single-char local part', () => {
    expect(maskEmail('a@test.com')).toBe('a***@test.com');
  });

  it('returns "System" for null/undefined', () => {
    expect(maskEmail(null)).toBe('System');
    expect(maskEmail(undefined)).toBe('System');
  });

  it('returns "System" for empty string', () => {
    expect(maskEmail('')).toBe('System');
  });

  it('returns the string unchanged if no @ present', () => {
    expect(maskEmail('noatsign')).toBe('noatsign');
  });
});

describe('normalizeDate', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizeDate(null)).toBe('');
    expect(normalizeDate(undefined)).toBe('');
    expect(normalizeDate('')).toBe('');
  });

  it('passes through YYYY-MM-DD format unchanged', () => {
    expect(normalizeDate('2025-03-15')).toBe('2025-03-15');
  });

  it('normalizes a Date object', () => {
    const d = new Date('2025-06-15T12:00:00Z');
    expect(normalizeDate(d)).toBe('2025-06-15');
  });

  it('normalizes a full ISO string', () => {
    expect(normalizeDate('2025-12-25T10:30:00.000Z')).toBe('2025-12-25');
  });

  it('returns original string for unparseable input', () => {
    expect(normalizeDate('not-a-date')).toBe('not-a-date');
  });
});

describe('normalizeTime', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizeTime(null)).toBe('');
    expect(normalizeTime(undefined)).toBe('');
    expect(normalizeTime('')).toBe('');
  });

  it('zero-pads single-digit hours', () => {
    expect(normalizeTime('6:30')).toBe('06:30');
    expect(normalizeTime('9:00')).toBe('09:00');
  });

  it('passes through double-digit hours', () => {
    expect(normalizeTime('18:00')).toBe('18:00');
    expect(normalizeTime('23:59')).toBe('23:59');
  });

  it('normalizes a Date object', () => {
    const d = new Date('2025-01-01T14:05:00Z');
    // This depends on local timezone — the function uses getHours() (local time)
    const expected = normalizeTime(d);
    expect(expected).toMatch(/^\d{2}:\d{2}$/);
  });

  it('returns original string for non-time input', () => {
    expect(normalizeTime('noon')).toBe('noon');
  });
});
