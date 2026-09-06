/**
 * Scheduler timezone and calendar-date helpers.
 *
 * Session dates are stored as plain YYYY-MM-DD strings in the table's local
 * timezone, so "today", "in 2 days" etc. must be computed in that timezone —
 * not in UTC (SQLite's date('now') / Date#toISOString) and not in whatever
 * the host process happens to run in.
 */
const DEFAULT_TIMEZONE = 'America/Chicago';

function isValidTimeZone(tz) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function resolveTimezone(env = process.env) {
  const candidate = env.SCHEDULER_TIMEZONE || env.TZ;
  if (isValidTimeZone(candidate)) return candidate;
  if (candidate) console.warn(`[Time] Invalid timezone "${candidate}", falling back to ${DEFAULT_TIMEZONE}`);
  return DEFAULT_TIMEZONE;
}

const SCHEDULER_TIMEZONE = resolveTimezone();

function parts(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  });
  const out = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** Calendar date (YYYY-MM-DD) of `date` in the scheduler timezone. */
function getLocalDate(date = new Date(), tz = SCHEDULER_TIMEZONE) {
  const p = parts(date, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hour of day (0-23) of `date` in the scheduler timezone. */
function getLocalHour(date = new Date(), tz = SCHEDULER_TIMEZONE) {
  // Some ICU versions format midnight as "24" with hour12:false.
  return parseInt(parts(date, tz).hour, 10) % 24;
}

/** Adds `days` (may be negative) to a YYYY-MM-DD string using pure calendar arithmetic. */
function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

module.exports = {
  DEFAULT_TIMEZONE,
  SCHEDULER_TIMEZONE,
  isValidTimeZone,
  resolveTimezone,
  getLocalDate,
  getLocalHour,
  addDays,
};
