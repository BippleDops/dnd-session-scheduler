/**
 * Recurring session service.
 * Auto-generates upcoming sessions from campaign recurring schedules.
 *
 * recurring_schedule format (JSON):
 *   { "dayOfWeek": 6, "time": "18:00", "duration": 4, "maxPlayers": 6, "tier": "any" }
 *   dayOfWeek: 0=Sunday, 6=Saturday
 *
 * recurring_exceptions format (JSON): array of date strings to skip
 *   ["2026-03-15", "2026-04-05"]
 */
const { getDb, generateUuid, normalizeDate, logAction } = require('../db');

/**
 * Generate upcoming sessions for a campaign based on its recurring schedule.
 * Creates sessions for the next `weeksAhead` weeks that don't already exist.
 * @returns {{ created: number, skipped: number }}
 */
function generateRecurringSessions(campaignId, weeksAhead = 4) {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE campaign_id = ?').get(campaignId);
  if (!campaign || !campaign.recurring_schedule) return { created: 0, skipped: 0 };

  let schedule;
  try { schedule = JSON.parse(campaign.recurring_schedule); } catch { return { created: 0, skipped: 0 }; }

  const { dayOfWeek, time, duration, maxPlayers, tier } = schedule;
  if (dayOfWeek === undefined || !time) return { created: 0, skipped: 0 };

  let exceptions = [];
  try { exceptions = JSON.parse(campaign.recurring_exceptions || '[]'); } catch {}
  const exceptionSet = new Set(exceptions);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let created = 0;
  let skipped = 0;

  for (let week = 0; week < weeksAhead; week++) {
    // Find next occurrence of dayOfWeek
    const target = new Date(today);
    target.setDate(today.getDate() + ((dayOfWeek - today.getDay() + 7) % 7) + (week * 7));
    if (target < today) { target.setDate(target.getDate() + 7); }

    const dateStr = normalizeDate(target);

    // Skip exceptions
    if (exceptionSet.has(dateStr)) { skipped++; continue; }

    // Check if a session already exists for this campaign on this date
    const existing = db.prepare(
      "SELECT 1 FROM sessions WHERE campaign = ? AND date = ? AND status = 'Scheduled'"
    ).get(campaign.name, dateStr);
    if (existing) { skipped++; continue; }

    // Create the session
    const sessionId = generateUuid();
    const dur = parseInt(duration, 10) || 4;
    const startParts = time.split(':');
    const endHour = parseInt(startParts[0], 10) + dur;
    const endTime = (endHour < 10 ? '0' : '') + endHour + ':' + (startParts[1] || '00');
    const dayType = (target.getDay() === 0 || target.getDay() === 6) ? 'Weekend' : 'Weeknight';

    db.prepare(`INSERT INTO sessions (session_id, date, day_type, start_time, duration, end_time,
      status, max_players, campaign, level_tier, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, ?, datetime('now'))`)
      .run(sessionId, dateStr, dayType, time, dur, endTime,
        parseInt(maxPlayers, 10) || 6, campaign.name, tier || 'any');

    created++;
  }

  if (created > 0) {
    logAction('RECURRING_GENERATED', `Generated ${created} sessions for ${campaign.name} (${skipped} skipped)`, 'System', campaignId);
  }

  return { created, skipped };
}

/**
 * Run recurring generation for all campaigns that have a schedule set.
 */
function generateAllRecurringSessions() {
  const db = getDb();
  const campaigns = db.prepare("SELECT campaign_id, name FROM campaigns WHERE recurring_schedule IS NOT NULL AND recurring_schedule != ''").all();
  let totalCreated = 0;
  for (const c of campaigns) {
    const result = generateRecurringSessions(c.campaign_id);
    totalCreated += result.created;
  }
  return { totalCreated, campaignsChecked: campaigns.length };
}

module.exports = { generateRecurringSessions, generateAllRecurringSessions };
