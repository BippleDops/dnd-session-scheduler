/**
 * Data export service. CSV and roster exports.
 * Ported from ExportService.gs and Code.gs exportData().
 */
const { getDb, normalizeDate, normalizeTime } = require('../db');

function exportData(type) {
  const db = getDb();
  let rows, headers;

  switch (type) {
    case 'sessions':
      rows = db.prepare('SELECT * FROM sessions ORDER BY date DESC').all();
      headers = Object.keys(rows[0] || {});
      break;
    case 'players':
      rows = db.prepare('SELECT * FROM players ORDER BY name').all();
      headers = Object.keys(rows[0] || {});
      break;
    case 'registrations':
      rows = db.prepare('SELECT * FROM registrations ORDER BY signup_timestamp DESC').all();
      headers = Object.keys(rows[0] || {});
      break;
    case 'history':
      rows = db.prepare('SELECT * FROM session_history ORDER BY session_date DESC').all();
      headers = Object.keys(rows[0] || {});
      break;
    default:
      return '';
  }

  if (!rows || rows.length === 0) return headers ? headers.join(',') + '\n' : '';

  let csv = headers.join(',') + '\n';
  for (const row of rows) {
    const vals = headers.map(h => '"' + String(row[h] || '').replace(/"/g, '""') + '"');
    csv += vals.join(',') + '\n';
  }
  return csv;
}

function exportSessionRoster(sessionId) {
  const db = getDb();
  const regs = db.prepare(`
    SELECT r.*, p.name AS player_name, p.email AS player_email
    FROM registrations r
    LEFT JOIN players p ON r.player_id = p.player_id
    WHERE r.session_id = ?
  `).all(sessionId);

  const headers = ['Player Name', 'Email', 'Character', 'Class', 'Level', 'Race', 'Status'];
  let csv = headers.join(',') + '\n';
  for (const r of regs) {
    const vals = [
      r.player_name, r.player_email, r.char_name_snapshot,
      r.class_snapshot, r.level_snapshot, r.race_snapshot || '', r.status,
    ].map(v => '"' + String(v || '').replace(/"/g, '""') + '"');
    csv += vals.join(',') + '\n';
  }
  return csv;
}

module.exports = { exportData, exportSessionRoster };

