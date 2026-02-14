/**
 * Registration (sign-up) service.
 * Ported from RegistrationService.gs.
 */
const { getDb, generateUuid, nowTimestamp, normalizeDate, normalizeTime, logAction, getConfigValue } = require('../db');
const { upsertPlayer, getPlayerByEmail } = require('./player-service');
const { getTierRange, getTierLabel } = require('./session-service');
const { createNotification } = require('./notification-service');
const { checkRateLimit } = require('../middleware/rate-limit');
const { validateCsrfToken } = require('../middleware/csrf');

const ACTION_TYPES = {
  REGISTRATION_CREATED: 'REGISTRATION_CREATED',
  REGISTRATION_CANCELLED: 'REGISTRATION_CANCELLED',
  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
};

function isWaitlistEnabled() {
  return getConfigValue('FEATURE_WAITLIST', 'FALSE').toUpperCase() === 'TRUE';
}

function isPlayerCancelEnabled() {
  return getConfigValue('FEATURE_PLAYER_CANCEL', 'TRUE').toUpperCase() === 'TRUE';
}

/**
 * Main sign-up entry point.
 */
function processSignup(formData) {
  // 1. CSRF
  if (!validateCsrfToken(formData.csrfToken)) {
    return { success: false, message: 'Session expired. Please refresh the page and try again.' };
  }

  // 2. Rate limit
  const rl = checkRateLimit(formData.email);
  if (!rl.allowed) return { success: false, message: rl.message };

  // 3. Basic validation
  const errors = {};
  if (!formData.name || !formData.name.trim()) errors.name = 'Name is required.';
  if (!formData.email || !formData.email.trim()) errors.email = 'Email is required.';
  if (!formData.characterName || !formData.characterName.trim()) errors.characterName = 'Character name is required.';
  if (!formData.characterClass) errors.characterClass = 'Select at least one class.';
  const level = parseInt(formData.characterLevel, 10);
  if (isNaN(level) || level < 1 || level > 20) errors.characterLevel = 'Level must be 1-20.';
  if (!formData.characterRace) errors.characterRace = 'Race/ancestry is required.';

  if (Object.keys(errors).length > 0) {
    return { success: false, message: 'Please fix the following errors:', errors };
  }

  // 3b. Email domain restriction
  const allowedDomains = getConfigValue('ALLOWED_EMAIL_DOMAINS', '');
  if (allowedDomains) {
    const domains = allowedDomains.split(',').map(d => d.trim().toLowerCase());
    const emailDomain = (formData.email.split('@')[1] || '').toLowerCase();
    if (!domains.includes(emailDomain)) {
      return { success: false, message: 'Sign-ups are restricted to specific email domains.' };
    }
  }

  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(formData.sessionId);
  if (!session) return { success: false, message: 'Session not found.' };
  if (session.status !== 'Scheduled') return { success: false, message: 'This session is no longer accepting sign-ups.' };

  // Signup deadline
  if (session.signup_deadline) {
    const deadline = new Date(session.signup_deadline);
    if (!isNaN(deadline.getTime()) && new Date() > deadline) {
      return { success: false, message: 'The sign-up deadline for this session has passed.' };
    }
  }

  // Tier-based level restriction
  const tier = session.level_tier || 'any';
  if (tier !== 'any') {
    const [minLv, maxLv] = getTierRange(tier);
    if (level < minLv || level > maxLv) {
      return { success: false, message: `This session requires ${getTierLabel(tier)}. Your character is level ${level}.` };
    }
  }

  const maxPlayers = session.max_players || 6;
  const confirmedCount = db.prepare(`
    SELECT COUNT(*) AS c FROM registrations
    WHERE session_id = ? AND status IN ('Confirmed','Attended')
  `).get(formData.sessionId).c;

  const sessionFull = confirmedCount >= maxPlayers;
  if (sessionFull && !isWaitlistEnabled()) {
    return { success: false, message: 'This session is full. Check the calendar for other open sessions!' };
  }

  const isWaitlisted = sessionFull;

  // Upsert player
  const playerResult = upsertPlayer({
    name: formData.name.trim(),
    email: formData.email.trim().toLowerCase(),
    preferredCampaign: formData.preferredCampaign || '',
    accessibilityNeeds: formData.accessibilityNeeds || '',
    dmNotes: formData.dmNotes || '',
    playedBefore: formData.playedBefore || '',
  });

  // Check for duplicate
  const existing = db.prepare(`
    SELECT * FROM registrations WHERE session_id = ? AND player_id = ?
  `).get(formData.sessionId, playerResult.playerId);

  let regId;
  if (existing) {
    if (existing.status === 'Confirmed') return { success: false, message: 'You are already registered for this session.' };
    if (existing.status === 'Waitlisted') return { success: false, message: 'You are already on the waitlist for this session.' };
    if (existing.status === 'Cancelled') {
      const newStatus = isWaitlisted ? 'Waitlisted' : 'Confirmed';
      db.prepare(`
        UPDATE registrations SET status = ?, char_name_snapshot = ?, class_snapshot = ?,
          level_snapshot = ?, race_snapshot = ?, signup_timestamp = datetime('now')
        WHERE registration_id = ?
      `).run(newStatus, formData.characterName, formData.characterClass,
        level, formData.characterRace, existing.registration_id);
      regId = existing.registration_id;
    }
  }

  if (!regId) {
    regId = generateUuid();
    // New signups go to 'Pending' — DM must approve
    db.prepare(`
      INSERT INTO registrations (registration_id, session_id, player_id,
        char_name_snapshot, class_snapshot, level_snapshot, race_snapshot,
        signup_timestamp, status, attendance_confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'Pending', 0)
    `).run(regId, formData.sessionId, playerResult.playerId,
      formData.characterName, formData.characterClass, level, formData.characterRace);
  }

  logAction(ACTION_TYPES.REGISTRATION_CREATED,
    `${formData.characterName} signed up (pending approval) for ${session.campaign} on ${session.date}`,
    formData.email, regId);

  // Notify the player
  try {
    createNotification(playerResult.playerId, 'registration',
      `Sign-up submitted for ${session.campaign} on ${normalizeDate(session.date)} — pending DM approval.`, regId);
  } catch { /* best effort */ }

  // Send signup received email
  try {
    const { sendEmail } = require('./reminder-service');
    const { wrapEmailTemplate } = require('../email/templates');
    const html = wrapEmailTemplate('Sign-Up Received',
      `<h2 style="color:#8b0000;">Sign-Up Received! ⏳</h2>
      <p>Hey ${formData.name},</p>
      <p><strong>${formData.characterName}</strong> has been submitted for <strong>${session.campaign}</strong> on ${normalizeDate(session.date)}.</p>
      <p>Your sign-up is <strong>pending DM approval</strong>. You'll receive an email once the DM reviews your registration.</p>`);
    sendEmail(formData.email, `D&D Session — Sign-Up Pending — ${session.campaign}`, html)
      .catch(e => console.error('Signup email error:', e.message));
  } catch {}

  return {
    success: true,
    message: "Sign-up submitted! The DM will review and approve your registration. You'll be notified by email.",
    registrationId: regId,
  };
}

/**
 * DM approves a pending registration.
 */
function approveRegistration(registrationId, adminEmail) {
  const db = getDb();
  const reg = db.prepare('SELECT r.*, p.name, p.email FROM registrations r JOIN players p ON r.player_id = p.player_id WHERE r.registration_id = ?').get(registrationId);
  if (!reg) return { success: false, error: 'Registration not found.' };
  if (reg.status !== 'Pending') return { success: false, error: 'Registration is not pending.' };

  db.prepare("UPDATE registrations SET status = 'Confirmed' WHERE registration_id = ?").run(registrationId);
  logAction('REGISTRATION_APPROVED', `${reg.char_name_snapshot} approved`, adminEmail, registrationId);

  // Notify + email the player
  try {
    createNotification(reg.player_id, 'registration', `✅ You're approved for the session! See you there.`, registrationId);
    const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(reg.session_id);
    if (session && reg.email) {
      const { sendEmail } = require('./reminder-service');
      const { wrapEmailTemplate } = require('../email/templates');
      const html = wrapEmailTemplate('Registration Approved',
        `<h2 style="color:#006600;">You're Approved! ✅</h2>
        <p>Hey ${reg.name},</p>
        <p><strong>${reg.char_name_snapshot}</strong> has been approved for <strong>${session.campaign}</strong> on ${normalizeDate(session.date)}.</p>
        <p>You'll receive a reminder the day before. See you at the table!</p>`);
      sendEmail(reg.email, `D&D Session — Approved! — ${session.campaign}`, html).catch(() => {});
    }
  } catch {}

  return { success: true };
}

/**
 * DM rejects a pending registration.
 */
function rejectRegistration(registrationId, adminEmail, reason) {
  const db = getDb();
  const reg = db.prepare('SELECT r.*, p.name, p.email FROM registrations r JOIN players p ON r.player_id = p.player_id WHERE r.registration_id = ?').get(registrationId);
  if (!reg) return { success: false, error: 'Registration not found.' };

  db.prepare("UPDATE registrations SET status = 'Cancelled' WHERE registration_id = ?").run(registrationId);
  logAction('REGISTRATION_REJECTED', `${reg.char_name_snapshot} rejected${reason ? ': ' + reason : ''}`, adminEmail, registrationId);

  // Notify + email the player
  try {
    createNotification(reg.player_id, 'registration', `Your signup was not approved this time.${reason ? ' Reason: ' + reason : ''}`, registrationId);
    if (reg.email) {
      const { sendEmail } = require('./reminder-service');
      const { wrapEmailTemplate } = require('../email/templates');
      const html = wrapEmailTemplate('Registration Not Approved',
        `<h2 style="color:#8b0000;">Not Approved This Time</h2>
        <p>Hey ${reg.name},</p>
        <p>Your signup for <strong>${reg.char_name_snapshot}</strong> was not approved.${reason ? ` <strong>Reason:</strong> ${reason}` : ''}</p>
        <p>Check the quest board for other upcoming sessions!</p>
        <p><a href="${process.env.BASE_URL || ''}/sessions" style="color:#8b0000;">Browse Sessions</a></p>`);
      sendEmail(reg.email, `D&D Session — Not Approved`, html).catch(() => {});
    }
  } catch {}

  return { success: true };
}

/**
 * Get all pending registrations (for DM dashboard).
 */
function getPendingRegistrations() {
  const db = getDb();
  return db.prepare(`
    SELECT r.registration_id, r.session_id, r.char_name_snapshot, r.class_snapshot,
           r.level_snapshot, r.race_snapshot, r.signup_timestamp,
           p.name AS player_name, p.email AS player_email,
           s.date, s.campaign, s.title
    FROM registrations r
    JOIN players p ON r.player_id = p.player_id
    JOIN sessions s ON r.session_id = s.session_id
    WHERE r.status = 'Pending' AND s.status = 'Scheduled'
    ORDER BY r.signup_timestamp
  `).all();
}

function cancelRegistration(registrationId) {
  const db = getDb();
  const reg = db.prepare('SELECT * FROM registrations WHERE registration_id = ?').get(registrationId);
  if (!reg) return { success: false, error: 'Registration not found.' };

  db.prepare("UPDATE registrations SET status = 'Cancelled' WHERE registration_id = ?").run(registrationId);
  logAction(ACTION_TYPES.REGISTRATION_CANCELLED, 'Registration cancelled', '', registrationId);

  if (isWaitlistEnabled()) promoteNextWaitlisted(reg.session_id);
  return { success: true };
}

function cancelMyRegistration(registrationId, email) {
  if (!isPlayerCancelEnabled()) return { success: false, message: 'Self-cancellation is not enabled.' };
  if (!email) return { success: false, message: 'Not authenticated.' };

  const db = getDb();
  const reg = db.prepare('SELECT * FROM registrations WHERE registration_id = ?').get(registrationId);
  if (!reg) return { success: false, message: 'Registration not found.' };

  const player = getPlayerByEmail(email);
  if (!player || player.player_id !== reg.player_id) {
    return { success: false, message: 'This registration does not belong to you.' };
  }
  if (reg.status !== 'Confirmed') return { success: false, message: 'This registration cannot be cancelled.' };

  db.prepare("UPDATE registrations SET status = 'Cancelled' WHERE registration_id = ?").run(registrationId);
  logAction(ACTION_TYPES.REGISTRATION_CANCELLED, 'Player self-cancelled', email, registrationId);

  if (isWaitlistEnabled()) promoteNextWaitlisted(reg.session_id);
  return { success: true, message: 'Registration cancelled successfully.' };
}

function promoteNextWaitlisted(sessionId) {
  const db = getDb();
  const waitlisted = db.prepare(`
    SELECT * FROM registrations WHERE session_id = ? AND status = 'Waitlisted'
    ORDER BY signup_timestamp ASC LIMIT 1
  `).get(sessionId);
  if (!waitlisted) return null;

  db.prepare("UPDATE registrations SET status = 'Confirmed' WHERE registration_id = ?")
    .run(waitlisted.registration_id);
  logAction(ACTION_TYPES.REGISTRATION_CREATED,
    'Waitlisted player auto-promoted: ' + waitlisted.char_name_snapshot,
    'System', waitlisted.registration_id);

  // Notify + email the promoted player
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
    const player = db.prepare('SELECT name, email FROM players WHERE player_id = ?').get(waitlisted.player_id);
    if (session) {
      createNotification(waitlisted.player_id, 'waitlist_promoted',
        `A spot opened up! You're now confirmed for ${session.campaign} on ${normalizeDate(session.date)}.`,
        waitlisted.registration_id);

      // Send promotion email
      if (player?.email) {
        const { sendEmail } = require('./reminder-service');
        const { buildWaitlistPromotionEmail, getEmailSubject } = require('../email/templates');
        const sessionData = {
          date: normalizeDate(session.date), startTime: normalizeTime(session.start_time),
          endTime: normalizeTime(session.end_time), campaign: session.campaign, title: session.title,
        };
        const html = buildWaitlistPromotionEmail(sessionData, player.name, waitlisted.char_name_snapshot || 'your character');
        sendEmail(player.email, getEmailSubject('waitlist-promotion', sessionData), html)
          .catch(e => console.error('Waitlist email error:', e.message));
      }
    }
  } catch { /* best effort */ }

  return waitlisted;
}

function markRegistrationAttendance(registrationId, attended) {
  const db = getDb();
  const reg = db.prepare('SELECT player_id FROM registrations WHERE registration_id = ?').get(registrationId);
  const newStatus = attended ? 'Attended' : 'No-Show';
  db.prepare(`
    UPDATE registrations SET status = ?, attendance_confirmed = ?
    WHERE registration_id = ?
  `).run(newStatus, attended ? 1 : 0, registrationId);
  logAction(ACTION_TYPES.ATTENDANCE_MARKED, `Attendance: ${newStatus}`, '', registrationId);

  // Evaluate achievements after attendance marking
  if (attended && reg?.player_id) {
    try { require('./achievement-engine').evaluateAchievements(reg.player_id); } catch {}
  }
  return { success: true };
}

function getMyRegistrationsData(email) {
  if (!email) return { upcoming: [], past: [], characters: [] };
  const db = getDb();
  const player = db.prepare('SELECT * FROM players WHERE email = ?').get(email.toLowerCase());
  if (!player) return { upcoming: [], past: [], characters: [] };

  const today = new Date().toISOString().slice(0, 10);
  const regs = db.prepare(`
    SELECT r.*, s.date, s.start_time, s.end_time, s.campaign, s.title, s.status AS session_status
    FROM registrations r
    JOIN sessions s ON r.session_id = s.session_id
    WHERE r.player_id = ? AND r.status != 'Cancelled'
    ORDER BY s.date
  `).all(player.player_id);

  const upcoming = [];
  const past = [];
  for (const r of regs) {
    const entry = {
      registrationId: r.registration_id,
      sessionId: r.session_id,
      date: normalizeDate(r.date),
      startTime: normalizeTime(r.start_time),
      endTime: normalizeTime(r.end_time),
      campaign: r.campaign || '',
      title: r.title || '',
      sessionStatus: r.session_status,
      characterName: r.char_name_snapshot || '',
      characterClass: r.class_snapshot || '',
      characterLevel: r.level_snapshot || 0,
      status: r.status,
      attended: !!r.attendance_confirmed,
    };
    if (normalizeDate(r.date) >= today && r.session_status === 'Scheduled') {
      upcoming.push(entry);
    } else {
      past.push(entry);
    }
  }

  past.sort((a, b) => b.date.localeCompare(a.date));

  const { getPlayerCharactersByEmail } = require('./player-service');
  const characters = getPlayerCharactersByEmail(email);

  return { upcoming, past, characters };
}

function getPublicRoster(sessionId) {
  return getDb().prepare(`
    SELECT char_name_snapshot AS characterName,
           class_snapshot AS characterClass,
           level_snapshot AS characterLevel
    FROM registrations
    WHERE session_id = ? AND status IN ('Confirmed','Attended')
  `).all(sessionId);
}

module.exports = {
  processSignup,
  approveRegistration,
  rejectRegistration,
  getPendingRegistrations,
  cancelRegistration,
  cancelMyRegistration,
  markRegistrationAttendance,
  getMyRegistrationsData,
  getPublicRoster,
  promoteNextWaitlisted,
  ACTION_TYPES,
};

