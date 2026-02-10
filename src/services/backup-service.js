/**
 * Backup service. Uses SQLite's backup API to copy the database.
 * Replaces DriveApp-based backups.
 */
const path = require('path');
const fs = require('fs');
const { getDb, logAction } = require('../db');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'backups');

function performBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const backupPath = path.join(BACKUP_DIR, `scheduler-backup-${today}.db`);

    const db = getDb();
    db.backup(backupPath).then(() => {
      // Verify backup integrity
      try {
        const Database = require('better-sqlite3');
        const backupDb = new Database(backupPath, { readonly: true });
        const result = backupDb.pragma('integrity_check');
        backupDb.close();
        const ok = result && result[0] && result[0].integrity_check === 'ok';
        logAction('BACKUP_COMPLETED', `Backup created: ${backupPath} (integrity: ${ok ? 'OK' : 'FAILED'})`, 'System', '');
        if (!ok) console.error('Backup integrity check failed!');
      } catch (e) {
        logAction('BACKUP_COMPLETED', `Backup created: ${backupPath} (integrity check error: ${e.message})`, 'System', '');
      }
      pruneOldBackups();
    }).catch(err => {
      console.error('Backup error:', err);
      logAction('BACKUP_FAILED', `Backup failed: ${err.message}`, 'System', '');
    });
  } catch (e) {
    console.error('Backup error:', e);
    logAction('BACKUP_FAILED', `Backup failed: ${e.message}`, 'System', '');
  }
}

function pruneOldBackups() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    for (const file of files) {
      if (!file.endsWith('.db')) continue;
      const match = file.match(/scheduler-backup-(\d{4}-\d{2}-\d{2})\.db/);
      if (match && new Date(match[1]) < cutoff) {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
      }
    }
  } catch (e) {
    console.error('Backup prune error:', e);
  }
}

function getLastBackupTimestamp() {
  const db = getDb();
  const row = db.prepare(`
    SELECT timestamp FROM admin_log
    WHERE action_type = 'BACKUP_COMPLETED'
    ORDER BY timestamp DESC LIMIT 1
  `).get();
  return row ? row.timestamp : '';
}

module.exports = { performBackup, getLastBackupTimestamp };

