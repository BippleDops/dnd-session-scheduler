/**
 * One-time migration script: Google Sheets → SQLite.
 * Reads existing data from the Google Sheet via Sheets API and imports into SQLite.
 *
 * Usage: npm run migrate
 * Requires: GOOGLE_SHEET_ID and a service account key or API key in .env
 */
require('dotenv').config();
const { google } = require('googleapis');
const { initializeDatabase, getDb, generateUuid, nowTimestamp } = require('./db');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function main() {
  if (!SHEET_ID) {
    console.error('Set GOOGLE_SHEET_ID in .env');
    process.exit(1);
  }

  console.log('Initializing database...');
  initializeDatabase();
  const db = getDb();

  // Authenticate with Google (API key or service account)
  let auth;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const keyFile = require('path').resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  } else if (process.env.GOOGLE_API_KEY) {
    auth = process.env.GOOGLE_API_KEY;
  } else {
    console.error('Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_API_KEY in .env');
    process.exit(1);
  }

  const sheets = google.sheets({ version: 'v4', auth });

  // Helper to read a sheet tab
  async function readTab(tabName) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: tabName,
      });
      const rows = res.data.values || [];
      if (rows.length < 2) return [];
      const headers = rows[0];
      return rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ''; });
        return obj;
      });
    } catch (e) {
      console.warn(`Could not read tab "${tabName}":`, e.message);
      return [];
    }
  }

  // ── Import Sessions ──
  console.log('Reading Sessions...');
  const sessions = await readTab('Sessions');
  const insertSession = db.prepare(`
    INSERT OR IGNORE INTO sessions (session_id, date, day_type, start_time, duration, end_time,
      status, max_players, campaign, title, description, dm_notes,
      signup_deadline, location, tags, difficulty, co_dm, prep_checklist,
      calendar_event_id, created_at, modified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sessionTx = db.transaction(() => {
    for (const s of sessions) {
      insertSession.run(
        s.SessionID, s.Date, s.DayType, s.StartTime,
        parseInt(s.Duration, 10) || 4, s.EndTime,
        s.Status || 'Scheduled', parseInt(s.MaxPlayers, 10) || 6,
        s.Campaign, s.Title, s.Description, s.DMNotes,
        s.SignupDeadline || null, s.Location, s.Tags, s.Difficulty,
        s.CoDM, s.PrepChecklist, s.CalendarEventID,
        s.CreatedAt || nowTimestamp(), s.ModifiedAt || null
      );
    }
  });
  sessionTx();
  console.log(`  Imported ${sessions.length} sessions`);

  // ── Import Players ──
  console.log('Reading Players...');
  const players = await readTab('Players');
  const insertPlayer = db.prepare(`
    INSERT OR IGNORE INTO players (player_id, name, email, pronouns, preferred_campaign,
      preferred_times, accessibility_needs, emergency_contact, dm_notes,
      played_before, registered_at, active_status, modified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const playerTx = db.transaction(() => {
    for (const p of players) {
      insertPlayer.run(
        p.PlayerID, p.Name, (p.Email || '').toLowerCase(),
        p.Pronouns || '', p.PreferredCampaign || '', p.PreferredTimes || '',
        p.AccessibilityNeeds || '', p.EmergencyContact || '', p.DMNotes || '',
        p.PlayedBefore || '', p.RegisteredAt || nowTimestamp(),
        p.ActiveStatus || 'Active', p.ModifiedAt || null
      );
    }
  });
  playerTx();
  console.log(`  Imported ${players.length} players`);

  // ── Import Registrations ──
  console.log('Reading Registrations...');
  const regs = await readTab('Registrations');
  const insertReg = db.prepare(`
    INSERT OR IGNORE INTO registrations (registration_id, session_id, player_id,
      char_name_snapshot, class_snapshot, subclass_snapshot, level_snapshot, race_snapshot,
      player_notes, admin_notes, signup_timestamp, status, attendance_confirmed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const regTx = db.transaction(() => {
    for (const r of regs) {
      insertReg.run(
        r.RegistrationID, r.SessionID, r.PlayerID,
        r.CharNameSnapshot, r.ClassSnapshot, r.SubclassSnapshot || '',
        parseInt(r.LevelSnapshot, 10) || 1, r.RaceSnapshot || '',
        r.PlayerNotes || '', r.AdminNotes || '',
        r.SignupTimestamp || nowTimestamp(),
        r.Status || 'Confirmed',
        r.AttendanceConfirmed === 'TRUE' || r.AttendanceConfirmed === true ? 1 : 0
      );
    }
  });
  regTx();
  console.log(`  Imported ${regs.length} registrations`);

  // ── Import SessionHistory ──
  console.log('Reading SessionHistory...');
  const history = await readTab('SessionHistory');
  const insertHistory = db.prepare(`
    INSERT OR IGNORE INTO session_history (session_id, session_date, campaign,
      attendee_char_names, attendee_count, recap_drafted, info_sheet_drafted,
      dm_post_notes, xp_awarded, created_at, modified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const histTx = db.transaction(() => {
    for (const h of history) {
      insertHistory.run(
        h.SessionID, h.SessionDate, h.Campaign,
        h.AttendeeCharNames || '', parseInt(h.AttendeeCount, 10) || 0,
        h.RecapDrafted === 'TRUE' ? 1 : 0,
        h.InfoSheetDrafted === 'TRUE' ? 1 : 0,
        h.DMPostNotes || '', h.XPAwarded || '',
        h.CreatedAt || nowTimestamp(), h.ModifiedAt || null
      );
    }
  });
  histTx();
  console.log(`  Imported ${history.length} history records`);

  // ── Import Config ──
  console.log('Reading Config...');
  const config = await readTab('Config');
  const insertConfig = db.prepare(`
    INSERT OR IGNORE INTO config (key, value, description, modified_at)
    VALUES (?, ?, ?, ?)
  `);

  const configTx = db.transaction(() => {
    for (const c of config) {
      insertConfig.run(c.Key, c.Value, c.Description || '', c.ModifiedAt || nowTimestamp());
    }
  });
  configTx();
  console.log(`  Imported ${config.length} config entries`);

  // ── Import AdminLog ──
  console.log('Reading AdminLog...');
  const logs = await readTab('AdminLog');
  const insertLog = db.prepare(`
    INSERT OR IGNORE INTO admin_log (log_id, timestamp, action_type, details, triggered_by, related_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const logTx = db.transaction(() => {
    for (const l of logs) {
      insertLog.run(l.LogID, l.Timestamp, l.ActionType, l.Details, l.TriggeredBy, l.RelatedID || '');
    }
  });
  logTx();
  console.log(`  Imported ${logs.length} log entries`);

  console.log('\nMigration complete!');
  console.log(`Database: ${require('path').join(__dirname, '..', 'data', 'scheduler.db')}`);
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});

