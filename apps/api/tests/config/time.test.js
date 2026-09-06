/**
 * Tests for src/config/time.js
 */
const {
  DEFAULT_TIMEZONE, isValidTimeZone, resolveTimezone, getLocalDate, getLocalHour, addDays,
} = require('../../src/config/time');

describe('resolveTimezone', () => {
  it('defaults to America/Chicago', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Chicago');
    expect(resolveTimezone({})).toBe('America/Chicago');
  });

  it('prefers SCHEDULER_TIMEZONE over TZ', () => {
    expect(resolveTimezone({ SCHEDULER_TIMEZONE: 'Europe/London', TZ: 'Asia/Tokyo' })).toBe('Europe/London');
    expect(resolveTimezone({ TZ: 'Asia/Tokyo' })).toBe('Asia/Tokyo');
  });

  it('falls back to the default for an invalid timezone', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveTimezone({ SCHEDULER_TIMEZONE: 'Not/AZone' })).toBe('America/Chicago');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('validates timezone names', () => {
    expect(isValidTimeZone('America/Chicago')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('getLocalDate / getLocalHour', () => {
  // 2026-03-15T03:30:00Z is still 2026-03-14 22:30 in Chicago (CDT, UTC-5)
  const lateEveningChicago = new Date('2026-03-15T03:30:00Z');

  it('returns the calendar date in the scheduler timezone, not UTC', () => {
    expect(lateEveningChicago.toISOString().slice(0, 10)).toBe('2026-03-15');
    expect(getLocalDate(lateEveningChicago, 'America/Chicago')).toBe('2026-03-14');
    expect(getLocalDate(lateEveningChicago, 'UTC')).toBe('2026-03-15');
    expect(getLocalDate(lateEveningChicago, 'Asia/Tokyo')).toBe('2026-03-15');
  });

  it('returns the hour in the scheduler timezone', () => {
    expect(getLocalHour(lateEveningChicago, 'America/Chicago')).toBe(22);
    expect(getLocalHour(lateEveningChicago, 'UTC')).toBe(3);
  });

  it('handles midnight as hour 0', () => {
    expect(getLocalHour(new Date('2026-01-10T06:00:00Z'), 'America/Chicago')).toBe(0); // CST, UTC-6
    expect(getLocalHour(new Date('2026-01-10T00:00:00Z'), 'UTC')).toBe(0);
  });
});

describe('addDays', () => {
  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2026-03-14', 2)).toBe('2026-03-16');
    expect(addDays('2026-03-30', 2)).toBe('2026-04-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('is a no-op for zero days', () => {
    expect(addDays('2026-03-14', 0)).toBe('2026-03-14');
  });
});
