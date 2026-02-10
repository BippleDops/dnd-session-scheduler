/**
 * Registration (sign-up) service.
 * Ported from RegistrationService.gs.
 */
const { getDb, generateUuid, nowTimestamp, normalizeDate, normalizeTime, logAction, getConfigValue } = require('../db');
const { upsertPlayer, getPlayerByEmail } = require('./player-service');
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
    db.prepare(`
      INSERT INTO registrations (registration_id, session_id, player_id,
        char_name_snapshot, class_snapshot, level_snapshot, race_snapshot,
        signup_timestamp, status, attendance_confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 0)
    `).run(regId, formData.sessionId, playerResult.playerId,
      formData.characterName, formData.characterClass, level, formData.characterRace,
      isWaitlisted ? 'Waitlisted' : 'Confirmed');
  }

  logAction(ACTION_TYPES.REGISTRATION_CREATED,
    `${formData.characterName} ${isWaitlisted ? 'waitlisted for' : 'registered for'} ${session.campaign} on ${session.date}`,
    formData.email, regId);

  if (isWaitlisted) {
    return {
      success: true,
      message: "This session is full, but you've been added to the waitlist! You'll be notified if a spot opens.",
      registrationId: regId, waitlisted: true,
    };
  }
  return {
    success: true,
    message: "You're in! Check your email for a confirmation with session details.",
    registrationId: regId,
  };
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
  return waitlisted;
}

function markRegistrationAttendance(registrationId, attended) {
  const db = getDb();
  const newStatus = attended ? 'Attended' : 'No-Show';
  db.prepare(`
    UPDATE registrations SET status = ?, attendance_confirmed = ?
    WHERE registration_id = ?
  `).run(newStatus, attended ? 1 : 0, registrationId);
  logAction(ACTION_TYPES.ATTENDANCE_MARKED, `Attendance: ${newStatus}`, '', registrationId);
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
  cancelRegistration,
  cancelMyRegistration,
  markRegistrationAttendance,
  getMyRegistrationsData,
  getPublicRoster,
  promoteNextWaitlisted,
  ACTION_TYPES,
};

