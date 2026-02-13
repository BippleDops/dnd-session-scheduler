/**
 * Email and reminder service.
 * Replaces ReminderService.gs — uses Nodemailer instead of GmailApp.
 */
const nodemailer = require('nodemailer');
const { getDb, getConfigValue, setConfigValue, generateUuid, nowTimestamp, logAction, normalizeDate, normalizeTime } = require('../db');
const { buildPlayerReminderEmail, buildDMInfoSheetEmail, buildCancellationEmail, getEmailSubject, wrapEmailTemplate } = require('../email/templates');
const { getPublicRoster } = require('./registration-service');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transporter;
}

function canSendMore() {
  const count = parseInt(getConfigValue('EMAIL_DAILY_COUNT', '0'), 10);
  const limit = parseInt(getConfigValue('EMAIL_DAILY_LIMIT', '100'), 10);
  return count < limit;
}

function incrementEmailCount() {
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = getConfigValue('EMAIL_LAST_DATE', '');
  let count = parseInt(getConfigValue('EMAIL_DAILY_COUNT', '0'), 10);
  if (lastDate !== today) { count = 0; setConfigValue('EMAIL_LAST_DATE', today); }
  count++;
  setConfigValue('EMAIL_DAILY_COUNT', String(count));
  return count;
}

async function sendEmail(to, subject, htmlBody) {
  if (!canSendMore()) {
    console.log('Email daily limit reached. Skipping:', to);
    return null;
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('SMTP not configured. Would send to:', to, 'Subject:', subject);
    return null;
  }

  try {
    const autoSend = (process.env.EMAIL_AUTO_SEND || getConfigValue('EMAIL_AUTO_SEND', 'false')).toUpperCase() === 'TRUE';
    if (!autoSend) {
      console.log('[Email Draft]', to, subject);
      // Log it but don't send
      const db = getDb();
      db.prepare(`INSERT INTO email_log (log_id, timestamp, type, recipient, subject, status)
        VALUES (?, datetime('now'), 'Draft', ?, ?, 'OK')`).run(generateUuid(), to, subject);
      incrementEmailCount();
      return { id: 'draft' };
    }

    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to, subject, html: htmlBody,
    });

    const db = getDb();
    db.prepare(`INSERT INTO email_log (log_id, timestamp, type, recipient, subject, status)
      VALUES (?, datetime('now'), 'Sent', ?, ?, 'OK')`).run(generateUuid(), to, subject);
    incrementEmailCount();
    return info;
  } catch (e) {
    console.error('Email error:', e.message);
    logAction('EMAIL_FAILED', `Email failed for ${to}: ${e.message}`, 'System', '');
    return null;
  }
}

async function sendConfirmationEmail(playerEmail, playerName, session, characterName) {
  const { buildConfirmationEmail } = require('../email/templates');
  const html = buildConfirmationEmail(session, { name: characterName }, playerName);
  const subject = getEmailSubject('confirmation', session);
  return sendEmail(playerEmail, subject, html);
}

async function draftPlayerReminders(sessionId) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
  if (!session) return { success: false, draftCount: 0 };

  const regs = db.prepare(`
    SELECT r.*, p.name AS player_name, p.email AS player_email
    FROM registrations r JOIN players p ON r.player_id = p.player_id
    WHERE r.session_id = ? AND r.status IN ('Confirmed','Attended')
  `).all(sessionId);

  const roster = getPublicRoster(sessionId);
  const sessionData = {
    date: normalizeDate(session.date), startTime: normalizeTime(session.start_time),
    endTime: normalizeTime(session.end_time), campaign: session.campaign, title: session.title,
  };

  let draftCount = 0;
  for (const reg of regs) {
    if (!reg.player_email) continue;
    const html = buildPlayerReminderEmail(sessionData, roster, reg.char_name_snapshot);
    const subject = getEmailSubject('reminder', sessionData);
    const result = await sendEmail(reg.player_email, subject, html);
    if (result) draftCount++;
  }
  return { success: true, draftCount };
}

async function draftDMInfoSheet(sessionId) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
  if (!session) return { success: false };

  const regs = db.prepare(`
    SELECT r.*, p.name AS playerName, p.email AS playerEmail,
           p.accessibility_needs AS accessibilityNeeds, p.dm_notes AS dmNotes, p.played_before AS playedBefore
    FROM registrations r JOIN players p ON r.player_id = p.player_id
    WHERE r.session_id = ? AND r.status IN ('Confirmed','Attended')
  `).all(sessionId);

  const players = regs.map(r => ({
    playerName: r.playerName, playerEmail: r.playerEmail,
    characterName: r.char_name_snapshot, characterClass: r.class_snapshot,
    characterLevel: r.level_snapshot, accessibilityNeeds: r.accessibilityNeeds,
    dmNotes: r.dmNotes, playedBefore: r.playedBefore,
  }));

  const sessionData = {
    date: normalizeDate(session.date), startTime: normalizeTime(session.start_time),
    endTime: normalizeTime(session.end_time), campaign: session.campaign,
    title: session.title, dmNotes: session.dm_notes,
  };

  const html = buildDMInfoSheetEmail(sessionData, players);
  const adminEmail = (process.env.ADMIN_EMAILS || '').split(',')[0].trim();
  const subject = getEmailSubject('dm-info', sessionData);
  await sendEmail(adminEmail, subject, html);

  db.prepare(`UPDATE session_history SET info_sheet_drafted = 1 WHERE session_id = ?`).run(sessionId);
  logAction('INFO_SHEET_DRAFTED', 'DM info sheet drafted', 'System', sessionId);
  return { success: true };
}

async function draftDMRecapReminder(sessionId) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
  if (!session) return { success: false };

  const adminEmail = (process.env.ADMIN_EMAILS || '').split(',')[0].trim();
  const subject = getEmailSubject('dm-recap', {
    campaign: session.campaign, date: normalizeDate(session.date),
  });
  const content = `<h2 style="color:#8b0000;">Session Recap Reminder</h2>
<p>Don't forget to add your post-session notes for <strong>${session.campaign}</strong> on ${normalizeDate(session.date)}.</p>
<p><a href="${process.env.BASE_URL}/?page=admin-history">Go to Session History</a></p>`;
  await sendEmail(adminEmail, subject, wrapEmailTemplate('Recap Reminder', content));

  db.prepare(`UPDATE session_history SET recap_drafted = 1 WHERE session_id = ?`).run(sessionId);
  logAction('RECAP_DRAFTED', 'Recap reminder drafted', 'System', sessionId);
  return { success: true };
}

async function dailyReminderCheck() {
  const db = getDb();
  const leadDays = parseInt(getConfigValue('REMINDER_LEAD_DAYS', '2'), 10);
  const followDays = parseInt(getConfigValue('RECAP_FOLLOW_DAYS', '1'), 10);

  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + leadDays);
  const reminderDateStr = reminderDate.toISOString().slice(0, 10);

  const recapDate = new Date();
  recapDate.setDate(recapDate.getDate() - followDays);
  const recapDateStr = recapDate.toISOString().slice(0, 10);

  let draftCount = 0;

  // Query only sessions that need reminders (upcoming on reminder date)
  const reminderSessions = db.prepare(
    "SELECT * FROM sessions WHERE date = ? AND status = 'Scheduled'"
  ).all(reminderDateStr);

  for (const s of reminderSessions) {
    try { const r = await draftPlayerReminders(s.session_id); draftCount += r.draftCount || 0; } catch (e) { console.error('Reminder error:', e); }
    try { await draftDMInfoSheet(s.session_id); draftCount++; } catch (e) { console.error('Info sheet error:', e); }
  }

  // Query only sessions that need recap reminders (past on recap date)
  const recapSessions = db.prepare(
    "SELECT * FROM sessions WHERE date = ? AND status IN ('Scheduled','Completed')"
  ).all(recapDateStr);

  for (const s of recapSessions) {
    try { await draftDMRecapReminder(s.session_id); draftCount++; } catch (e) { console.error('Recap error:', e); }
  }

  logAction('REMINDER_DRAFTED', `Daily check completed. ${draftCount} emails processed.`, 'System', '');
  return { success: true, draftCount };
}

async function postToDiscord(message) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || getConfigValue('DISCORD_WEBHOOK_URL', '');
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
  } catch (e) { console.error('Discord webhook error:', e.message); }
}

module.exports = {
  sendEmail,
  sendConfirmationEmail,
  draftPlayerReminders,
  draftDMInfoSheet,
  draftDMRecapReminder,
  dailyReminderCheck,
  postToDiscord,
};

