/**
 * Tests for session-service.js
 */
const { setupDbMock, closeTestDb, insertTestPlayer, insertTestSession, insertTestRegistration } = require('../helpers/setup-db');

let db;

beforeEach(() => {
  jest.resetModules();
  db = setupDbMock();
  // Mock reminder-service to avoid email side effects
  jest.mock('../../src/services/reminder-service', () => ({
    postToDiscord: jest.fn(),
    sendEmail: jest.fn().mockResolvedValue({}),
  }));
  jest.mock('../../src/services/notification-service', () => ({
    createNotification: jest.fn(),
  }));
  jest.mock('../../src/email/templates', () => ({
    buildCancellationEmail: jest.fn(() => '<html>cancelled</html>'),
    buildSessionUpdateEmail: jest.fn(() => '<html>updated</html>'),
    getEmailSubject: jest.fn(() => 'Test Subject'),
  }));
  // Mock achievement-engine (may not exist or is optional)
  jest.mock('../../src/services/achievement-engine', () => ({
    evaluateAchievements: jest.fn(),
  }), { virtual: true });
});

afterEach(() => {
  closeTestDb();
  jest.restoreAllMocks();
});

describe('TIER_RANGES and TIER_LABELS', () => {
  it('exports correct tier ranges', () => {
    const { TIER_RANGES, getTierRange, getTierLabel } = require('../../src/services/session-service');
    expect(TIER_RANGES.any).toEqual([1, 20]);
    expect(TIER_RANGES.tier1).toEqual([1, 4]);
    expect(TIER_RANGES.tier2).toEqual([5, 10]);
    expect(TIER_RANGES.tier3).toEqual([11, 16]);
    expect(TIER_RANGES.tier4).toEqual([17, 20]);
    expect(getTierRange('tier2')).toEqual([5, 10]);
    expect(getTierRange('invalid')).toEqual([1, 20]);
    expect(getTierLabel('tier1')).toBe('Tier 1: Lv 1-4');
    expect(getTierLabel('invalid')).toBe('');
  });
});

describe('getCampaignList', () => {
  it('returns campaign list from config', () => {
    const { getCampaignList } = require('../../src/services/session-service');
    const list = getCampaignList();
    expect(list).toContain('Aethermoor');
    expect(list).toContain('Aquabyssos');
    expect(list.length).toBe(4);
  });
});

describe('createSessionRecord', () => {
  it('creates a session and returns success with ID', () => {
    const { createSessionRecord } = require('../../src/services/session-service');
    const result = createSessionRecord({
      date: '2025-06-15',
      startTime: '18:00',
      duration: '4',
      maxPlayers: '5',
      campaign: 'Aethermoor',
      title: 'Dragon Hunt',
      description: 'Slay the dragon',
      levelTier: 'tier2',
    }, 'admin@test.com');

    expect(result.success).toBe(true);
    expect(result.sessionId).toBeDefined();

    // Verify in DB
    const row = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(result.sessionId);
    expect(row.date).toBe('2025-06-15');
    expect(row.campaign).toBe('Aethermoor');
    expect(row.title).toBe('Dragon Hunt');
    expect(row.max_players).toBe(5);
    expect(row.level_tier).toBe('tier2');
    expect(row.end_time).toBe('22:00');
    expect(row.status).toBe('Scheduled');
  });

  it('calculates end_time from start_time + duration', () => {
    const { createSessionRecord } = require('../../src/services/session-service');
    const result = createSessionRecord({
      date: '2025-06-15',
      startTime: '14:30',
      duration: '3',
    }, 'admin@test.com');

    const row = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(result.sessionId);
    expect(row.end_time).toBe('17:30');
  });

  it('defaults to tier "any" for invalid tier', () => {
    const { createSessionRecord } = require('../../src/services/session-service');
    const result = createSessionRecord({
      date: '2025-06-15',
      levelTier: 'invalid_tier',
    }, 'admin@test.com');

    const row = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(result.sessionId);
    expect(row.level_tier).toBe('any');
  });

  it('logs the action to admin_log', () => {
    const { createSessionRecord } = require('../../src/services/session-service');
    createSessionRecord({ date: '2025-06-15', campaign: 'Aethermoor' }, 'admin@test.com');
    const log = db.prepare("SELECT * FROM admin_log WHERE action_type = 'SESSION_CREATED'").get();
    expect(log).toBeTruthy();
    expect(log.details).toContain('Aethermoor');
  });
});

describe('getSessionById', () => {
  it('returns null for nonexistent session', () => {
    const { getSessionById } = require('../../src/services/session-service');
    expect(getSessionById('nonexistent')).toBeNull();
  });

  it('returns session with public roster', () => {
    const { getSessionById } = require('../../src/services/session-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db);
    insertTestRegistration(db, session.session_id, player.player_id, {
      char_name: 'Gandalf', char_class: 'Wizard', level: 10,
    });

    const result = getSessionById(session.session_id);
    expect(result.sessionId).toBe(session.session_id);
    expect(result.registeredCount).toBe(1);
    expect(result.roster).toHaveLength(1);
    expect(result.roster[0].characterName).toBe('Gandalf');
    // Private fields should be empty
    expect(result.dmNotes).toBe('');
    expect(result.registrations).toBeUndefined();
  });

  it('includes private data when includePrivate=true', () => {
    const { getSessionById } = require('../../src/services/session-service');
    const session = insertTestSession(db, { dm_notes: 'secret notes' });
    // Update dm_notes directly
    db.prepare('UPDATE sessions SET dm_notes = ? WHERE session_id = ?').run('secret notes', session.session_id);

    const result = getSessionById(session.session_id, true);
    expect(result.dmNotes).toBe('secret notes');
    expect(result.registrations).toBeDefined();
  });
});

describe('updateSessionRecord', () => {
  it('updates session fields', () => {
    const { updateSessionRecord } = require('../../src/services/session-service');
    const session = insertTestSession(db);

    const result = updateSessionRecord(session.session_id, {
      title: 'Updated Title',
      maxPlayers: 8,
    }, 'admin@test.com');

    expect(result.success).toBe(true);
    const row = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(session.session_id);
    expect(row.title).toBe('Updated Title');
    expect(row.max_players).toBe(8);
  });

  it('returns error for nonexistent session', () => {
    const { updateSessionRecord } = require('../../src/services/session-service');
    const result = updateSessionRecord('nonexistent', { title: 'X' }, 'admin@test.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('cancelSessionRecord', () => {
  it('sets status to Cancelled', () => {
    const { cancelSessionRecord } = require('../../src/services/session-service');
    const session = insertTestSession(db);

    const result = cancelSessionRecord(session.session_id, false, 'admin@test.com');
    expect(result.success).toBe(true);

    const row = db.prepare('SELECT status FROM sessions WHERE session_id = ?').get(session.session_id);
    expect(row.status).toBe('Cancelled');
  });

  it('notifies registered players when notify=true', () => {
    const { cancelSessionRecord } = require('../../src/services/session-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db);
    insertTestRegistration(db, session.session_id, player.player_id);

    cancelSessionRecord(session.session_id, true, 'admin@test.com');

    const { createNotification } = require('../../src/services/notification-service');
    expect(createNotification).toHaveBeenCalled();
  });
});

describe('completeSessionRecord', () => {
  it('sets status to Completed and creates history entry', () => {
    const { completeSessionRecord } = require('../../src/services/session-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db);
    insertTestRegistration(db, session.session_id, player.player_id, { char_name: 'Legolas' });

    const result = completeSessionRecord(session.session_id, 'admin@test.com');
    expect(result.success).toBe(true);

    const row = db.prepare('SELECT status FROM sessions WHERE session_id = ?').get(session.session_id);
    expect(row.status).toBe('Completed');

    const history = db.prepare('SELECT * FROM session_history WHERE session_id = ?').get(session.session_id);
    expect(history).toBeTruthy();
    expect(history.attendee_char_names).toContain('Legolas');
    expect(history.attendee_count).toBe(1);
  });

  it('returns error for nonexistent session', () => {
    const { completeSessionRecord } = require('../../src/services/session-service');
    const result = completeSessionRecord('nonexistent', 'admin@test.com');
    expect(result.success).toBe(false);
  });
});

describe('getAllSessionsAdmin', () => {
  it('returns all sessions', () => {
    const { getAllSessionsAdmin } = require('../../src/services/session-service');
    insertTestSession(db, { campaign: 'Aethermoor' });
    insertTestSession(db, { campaign: 'Terravor', status: 'Completed' });

    const result = getAllSessionsAdmin();
    expect(result.length).toBe(2);
  });

  it('filters by status', () => {
    const { getAllSessionsAdmin } = require('../../src/services/session-service');
    insertTestSession(db, { status: 'Scheduled' });
    insertTestSession(db, { status: 'Completed' });

    const result = getAllSessionsAdmin({ status: 'Scheduled' });
    expect(result.every(s => s.status === 'Scheduled')).toBe(true);
  });

  it('filters by campaign', () => {
    const { getAllSessionsAdmin } = require('../../src/services/session-service');
    insertTestSession(db, { campaign: 'Aethermoor' });
    insertTestSession(db, { campaign: 'Terravor' });

    const result = getAllSessionsAdmin({ campaign: 'Aethermoor' });
    expect(result.every(s => s.campaign === 'Aethermoor')).toBe(true);
  });
});

describe('cloneSessionRecord', () => {
  it('clones a session to a new date', () => {
    const { cloneSessionRecord } = require('../../src/services/session-service');
    const session = insertTestSession(db, { campaign: 'Aethermoor', title: 'Original' });

    const result = cloneSessionRecord(session.session_id, '2025-07-01', 'admin@test.com');
    expect(result.success).toBe(true);
    expect(result.sessionId).not.toBe(session.session_id);

    const cloned = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(result.sessionId);
    expect(cloned.date).toBe('2025-07-01');
    expect(cloned.campaign).toBe('Aethermoor');
    expect(cloned.title).toBe('Original');
  });

  it('returns error for nonexistent source session', () => {
    const { cloneSessionRecord } = require('../../src/services/session-service');
    const result = cloneSessionRecord('nonexistent', '2025-07-01', 'admin@test.com');
    expect(result.success).toBe(false);
  });
});

describe('getSessionHistoryRecords', () => {
  it('returns history entries', () => {
    const { getSessionHistoryRecords } = require('../../src/services/session-service');
    const session = insertTestSession(db);
    db.prepare(`INSERT INTO session_history (session_id, session_date, campaign, attendee_count) VALUES (?, ?, ?, ?)`)
      .run(session.session_id, session.date, 'Aethermoor', 3);

    const records = getSessionHistoryRecords();
    expect(records.length).toBe(1);
    expect(records[0].attendeeCount).toBe(3);
  });

  it('filters by campaign', () => {
    const { getSessionHistoryRecords } = require('../../src/services/session-service');
    const s1 = insertTestSession(db);
    const s2 = insertTestSession(db);
    db.prepare(`INSERT INTO session_history (session_id, session_date, campaign) VALUES (?, ?, ?)`)
      .run(s1.session_id, '2025-01-01', 'Aethermoor');
    db.prepare(`INSERT INTO session_history (session_id, session_date, campaign) VALUES (?, ?, ?)`)
      .run(s2.session_id, '2025-01-02', 'Terravor');

    const records = getSessionHistoryRecords({ campaign: 'Terravor' });
    expect(records.length).toBe(1);
    expect(records[0].campaign).toBe('Terravor');
  });
});

describe('updateSessionHistoryNotes', () => {
  it('updates DM post-session notes', () => {
    const { updateSessionHistoryNotes } = require('../../src/services/session-service');
    const session = insertTestSession(db);
    db.prepare(`INSERT INTO session_history (session_id, session_date, campaign) VALUES (?, ?, ?)`)
      .run(session.session_id, session.date, 'Aethermoor');

    const result = updateSessionHistoryNotes(session.session_id, 'Great session!');
    expect(result.success).toBe(true);

    const row = db.prepare('SELECT dm_post_notes FROM session_history WHERE session_id = ?').get(session.session_id);
    expect(row.dm_post_notes).toBe('Great session!');
  });

  it('returns error for nonexistent history', () => {
    const { updateSessionHistoryNotes } = require('../../src/services/session-service');
    const result = updateSessionHistoryNotes('nonexistent', 'notes');
    expect(result.success).toBe(false);
  });
});

describe('getUpcomingSessions', () => {
  it('returns only future scheduled sessions', () => {
    const { getUpcomingSessions } = require('../../src/services/session-service');

    // Future session
    insertTestSession(db, { date: '2099-01-01', status: 'Scheduled' });
    // Past session
    insertTestSession(db, { date: '2020-01-01', status: 'Scheduled' });
    // Future but cancelled
    insertTestSession(db, { date: '2099-02-01', status: 'Cancelled' });

    const sessions = getUpcomingSessions();
    expect(sessions.length).toBe(1);
    expect(sessions[0].date).toBe('2099-01-01');
  });

  it('includes roster for each session', () => {
    const { getUpcomingSessions } = require('../../src/services/session-service');
    const session = insertTestSession(db, { date: '2099-01-01' });
    const player = insertTestPlayer(db);
    insertTestRegistration(db, session.session_id, player.player_id, { char_name: 'Frodo' });

    const sessions = getUpcomingSessions();
    expect(sessions[0].roster).toHaveLength(1);
    expect(sessions[0].registeredCount).toBe(1);
    expect(sessions[0].spotsRemaining).toBe(5);
  });
});
