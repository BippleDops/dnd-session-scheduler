/**
 * Tests for registration-service.js
 */
const { setupDbMock, closeTestDb, insertTestPlayer, insertTestSession, insertTestRegistration } = require('../helpers/setup-db');

let db;

beforeEach(() => {
  jest.resetModules();
  db = setupDbMock();
  // Mock external dependencies
  jest.mock('../../src/services/reminder-service', () => ({
    sendEmail: jest.fn().mockResolvedValue({}),
  }));
  jest.mock('../../src/services/notification-service', () => ({
    createNotification: jest.fn(),
  }));
  jest.mock('../../src/email/templates', () => ({
    wrapEmailTemplate: jest.fn(() => '<html>email</html>'),
    buildWaitlistPromotionEmail: jest.fn(() => '<html>promoted</html>'),
    getEmailSubject: jest.fn(() => 'Subject'),
  }));
  jest.mock('../../src/services/achievement-engine', () => ({
    evaluateAchievements: jest.fn(),
  }), { virtual: true });
});

afterEach(() => {
  closeTestDb();
  jest.restoreAllMocks();
});

describe('processSignup', () => {
  it('rejects with invalid CSRF token', () => {
    const { processSignup } = require('../../src/services/registration-service');
    const result = processSignup({ csrfToken: 'invalid' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Session expired');
  });

  it('rejects missing required fields', () => {
    // Generate a valid CSRF token first
    const { generateCsrfToken } = require('../../src/middleware/csrf');
    const token = generateCsrfToken('test-session');
    const { processSignup } = require('../../src/services/registration-service');

    const result = processSignup({
      csrfToken: token,
      email: 'test@test.com',
      name: '',
      characterName: '',
      characterClass: '',
      characterLevel: '0',
      characterRace: '',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.name).toBeDefined();
    expect(result.errors.characterName).toBeDefined();
  });

  it('rejects signup for nonexistent session', () => {
    const { generateCsrfToken } = require('../../src/middleware/csrf');
    const token = generateCsrfToken('test-session');
    const { processSignup } = require('../../src/services/registration-service');

    const result = processSignup({
      csrfToken: token,
      email: 'test@test.com',
      name: 'Test Player',
      characterName: 'Thorn',
      characterClass: 'Fighter',
      characterLevel: '5',
      characterRace: 'Human',
      sessionId: 'nonexistent',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Session not found');
  });

  it('successfully registers a player for a session', () => {
    const { generateCsrfToken } = require('../../src/middleware/csrf');
    const token = generateCsrfToken('test-session');
    const { processSignup } = require('../../src/services/registration-service');
    const session = insertTestSession(db);

    const result = processSignup({
      csrfToken: token,
      email: 'hero@test.com',
      name: 'Hero',
      characterName: 'Thorn',
      characterClass: 'Fighter',
      characterLevel: '5',
      characterRace: 'Human',
      sessionId: session.session_id,
    });

    expect(result.success).toBe(true);
    expect(result.registrationId).toBeDefined();

    // Verify registration was created
    const reg = db.prepare('SELECT * FROM registrations WHERE registration_id = ?').get(result.registrationId);
    expect(reg.char_name_snapshot).toBe('Thorn');
    expect(reg.status).toBe('Pending');
  });

  it('rejects duplicate registration', () => {
    const { processSignup } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db, { email: 'dup@test.com' });
    insertTestRegistration(db, session.session_id, player.player_id, { status: 'Confirmed' });

    const { generateCsrfToken } = require('../../src/middleware/csrf');
    const token = generateCsrfToken('test');

    const result = processSignup({
      csrfToken: token,
      email: 'dup@test.com',
      name: 'Dup Player',
      characterName: 'Dup Char',
      characterClass: 'Wizard',
      characterLevel: '3',
      characterRace: 'Elf',
      sessionId: session.session_id,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('already registered');
  });

  it('rejects when session is full and waitlist disabled', () => {
    const { processSignup } = require('../../src/services/registration-service');
    const session = insertTestSession(db, { max_players: 1 });
    const player = insertTestPlayer(db, { email: 'first@test.com' });
    insertTestRegistration(db, session.session_id, player.player_id);

    const { generateCsrfToken } = require('../../src/middleware/csrf');
    const token = generateCsrfToken('test');

    const result = processSignup({
      csrfToken: token,
      email: 'second@test.com',
      name: 'Second',
      characterName: 'Latecomer',
      characterClass: 'Rogue',
      characterLevel: '3',
      characterRace: 'Halfling',
      sessionId: session.session_id,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('full');
  });

  it('rejects character level outside tier range', () => {
    const { processSignup } = require('../../src/services/registration-service');
    const session = insertTestSession(db, { level_tier: 'tier1' }); // levels 1-4

    const { generateCsrfToken } = require('../../src/middleware/csrf');
    const token = generateCsrfToken('test');

    const result = processSignup({
      csrfToken: token,
      email: 'high@test.com',
      name: 'High Level',
      characterName: 'OP Character',
      characterClass: 'Wizard',
      characterLevel: '10', // too high for tier1
      characterRace: 'Elf',
      sessionId: session.session_id,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Tier 1');
  });

  it('rejects signup for cancelled session', () => {
    const { processSignup } = require('../../src/services/registration-service');
    const session = insertTestSession(db, { status: 'Cancelled' });

    const { generateCsrfToken } = require('../../src/middleware/csrf');
    const token = generateCsrfToken('test');

    const result = processSignup({
      csrfToken: token,
      email: 'late@test.com',
      name: 'Late',
      characterName: 'Too Late',
      characterClass: 'Bard',
      characterLevel: '5',
      characterRace: 'Tiefling',
      sessionId: session.session_id,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('no longer accepting');
  });
});

describe('approveRegistration', () => {
  it('approves a pending registration', () => {
    const { approveRegistration } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db);
    const reg = insertTestRegistration(db, session.session_id, player.player_id, { status: 'Pending' });

    const result = approveRegistration(reg.registration_id, 'admin@test.com');
    expect(result.success).toBe(true);

    const row = db.prepare('SELECT status FROM registrations WHERE registration_id = ?').get(reg.registration_id);
    expect(row.status).toBe('Confirmed');
  });

  it('rejects non-pending registration', () => {
    const { approveRegistration } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db);
    const reg = insertTestRegistration(db, session.session_id, player.player_id, { status: 'Confirmed' });

    const result = approveRegistration(reg.registration_id, 'admin@test.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not pending');
  });
});

describe('rejectRegistration', () => {
  it('rejects a registration and sets to Cancelled', () => {
    const { rejectRegistration } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db);
    const reg = insertTestRegistration(db, session.session_id, player.player_id, { status: 'Pending' });

    const result = rejectRegistration(reg.registration_id, 'admin@test.com', 'Session is full');
    expect(result.success).toBe(true);

    const row = db.prepare('SELECT status FROM registrations WHERE registration_id = ?').get(reg.registration_id);
    expect(row.status).toBe('Cancelled');
  });
});

describe('cancelRegistration', () => {
  it('cancels a registration', () => {
    const { cancelRegistration } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db);
    const reg = insertTestRegistration(db, session.session_id, player.player_id);

    const result = cancelRegistration(reg.registration_id);
    expect(result.success).toBe(true);

    const row = db.prepare('SELECT status FROM registrations WHERE registration_id = ?').get(reg.registration_id);
    expect(row.status).toBe('Cancelled');
  });
});

describe('cancelMyRegistration', () => {
  it('allows player to self-cancel their own confirmed registration', () => {
    const { cancelMyRegistration } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db, { email: 'self@test.com' });
    const reg = insertTestRegistration(db, session.session_id, player.player_id);

    const result = cancelMyRegistration(reg.registration_id, 'self@test.com');
    expect(result.success).toBe(true);
  });

  it('prevents cancelling another player registration', () => {
    const { cancelMyRegistration } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    const player1 = insertTestPlayer(db, { email: 'owner@test.com' });
    const player2 = insertTestPlayer(db, { email: 'other@test.com' });
    const reg = insertTestRegistration(db, session.session_id, player1.player_id);

    const result = cancelMyRegistration(reg.registration_id, 'other@test.com');
    expect(result.success).toBe(false);
    expect(result.message).toContain('does not belong');
  });

  it('rejects unauthenticated cancel', () => {
    const { cancelMyRegistration } = require('../../src/services/registration-service');
    const result = cancelMyRegistration('any-id', null);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Not authenticated');
  });
});

describe('markRegistrationAttendance', () => {
  it('marks as Attended', () => {
    const { markRegistrationAttendance } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db);
    const reg = insertTestRegistration(db, session.session_id, player.player_id);

    const result = markRegistrationAttendance(reg.registration_id, true);
    expect(result.success).toBe(true);

    const row = db.prepare('SELECT status, attendance_confirmed FROM registrations WHERE registration_id = ?').get(reg.registration_id);
    expect(row.status).toBe('Attended');
    expect(row.attendance_confirmed).toBe(1);
  });

  it('marks as No-Show', () => {
    const { markRegistrationAttendance } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db);
    const reg = insertTestRegistration(db, session.session_id, player.player_id);

    markRegistrationAttendance(reg.registration_id, false);
    const row = db.prepare('SELECT status FROM registrations WHERE registration_id = ?').get(reg.registration_id);
    expect(row.status).toBe('No-Show');
  });
});

describe('getPendingRegistrations', () => {
  it('returns only pending registrations for scheduled sessions', () => {
    const { getPendingRegistrations } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db);
    insertTestRegistration(db, session.session_id, player.player_id, { status: 'Pending' });
    insertTestRegistration(db, session.session_id, insertTestPlayer(db).player_id, { status: 'Confirmed' });

    const pending = getPendingRegistrations();
    expect(pending.length).toBe(1);
    expect(pending[0].player_name).toBeDefined();
    expect(pending[0].campaign).toBeDefined();
  });
});

describe('getPublicRoster', () => {
  it('returns confirmed players only', () => {
    const { getPublicRoster } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    insertTestRegistration(db, session.session_id, insertTestPlayer(db).player_id, { status: 'Confirmed', char_name: 'Hero' });
    insertTestRegistration(db, session.session_id, insertTestPlayer(db).player_id, { status: 'Cancelled', char_name: 'Quitter' });

    const roster = getPublicRoster(session.session_id);
    expect(roster.length).toBe(1);
    expect(roster[0].characterName).toBe('Hero');
  });
});

describe('getMyRegistrationsData', () => {
  it('separates upcoming and past registrations', () => {
    const { getMyRegistrationsData } = require('../../src/services/registration-service');
    const player = insertTestPlayer(db, { email: 'me@test.com' });

    // Future session
    const future = insertTestSession(db, { date: '2099-01-01' });
    insertTestRegistration(db, future.session_id, player.player_id);

    // Past session
    const past = insertTestSession(db, { date: '2020-01-01', status: 'Completed' });
    insertTestRegistration(db, past.session_id, player.player_id, { status: 'Attended' });

    const data = getMyRegistrationsData('me@test.com');
    expect(data.upcoming.length).toBe(1);
    expect(data.past.length).toBe(1);
  });

  it('excludes cancelled registrations', () => {
    const { getMyRegistrationsData } = require('../../src/services/registration-service');
    const player = insertTestPlayer(db, { email: 'me@test.com' });
    const session = insertTestSession(db, { date: '2099-01-01' });
    insertTestRegistration(db, session.session_id, player.player_id, { status: 'Cancelled' });

    const data = getMyRegistrationsData('me@test.com');
    expect(data.upcoming.length).toBe(0);
    expect(data.past.length).toBe(0);
  });

  it('returns empty for unknown email', () => {
    const { getMyRegistrationsData } = require('../../src/services/registration-service');
    const data = getMyRegistrationsData('nobody@test.com');
    expect(data.upcoming).toEqual([]);
    expect(data.past).toEqual([]);
  });
});

describe('promoteNextWaitlisted', () => {
  it('promotes the earliest waitlisted player', () => {
    const { promoteNextWaitlisted } = require('../../src/services/registration-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db);
    const reg = insertTestRegistration(db, session.session_id, player.player_id, { status: 'Waitlisted' });

    const promoted = promoteNextWaitlisted(session.session_id);
    expect(promoted).toBeTruthy();

    const row = db.prepare('SELECT status FROM registrations WHERE registration_id = ?').get(reg.registration_id);
    expect(row.status).toBe('Confirmed');
  });

  it('returns null if no one is waitlisted', () => {
    const { promoteNextWaitlisted } = require('../../src/services/registration-service');
    const session = insertTestSession(db);

    const result = promoteNextWaitlisted(session.session_id);
    expect(result).toBeNull();
  });
});
