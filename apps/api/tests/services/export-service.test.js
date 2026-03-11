/**
 * Tests for export-service.js
 */
const { setupDbMock, closeTestDb, insertTestPlayer, insertTestSession, insertTestRegistration } = require('../helpers/setup-db');

let db;

beforeEach(() => {
  jest.resetModules();
  db = setupDbMock();
});

afterEach(() => {
  closeTestDb();
  jest.restoreAllMocks();
});

describe('exportData', () => {
  it('exports sessions as CSV', () => {
    const { exportData } = require('../../src/services/export-service');
    insertTestSession(db, { campaign: 'Aethermoor', title: 'Export Test' });

    const csv = exportData('sessions');
    expect(csv).toContain('session_id');
    expect(csv).toContain('Aethermoor');
    expect(csv).toContain('Export Test');
  });

  it('exports players as CSV', () => {
    const { exportData } = require('../../src/services/export-service');
    insertTestPlayer(db, { name: 'CSV Player', email: 'csv@test.com' });

    const csv = exportData('players');
    expect(csv).toContain('player_id');
    expect(csv).toContain('CSV Player');
  });

  it('returns empty string for unknown type', () => {
    const { exportData } = require('../../src/services/export-service');
    expect(exportData('unknown')).toBe('');
  });

  it('handles empty tables gracefully', () => {
    const { exportData } = require('../../src/services/export-service');
    const csv = exportData('history');
    // Should return headers only or empty
    expect(typeof csv).toBe('string');
  });

  it('escapes quotes in CSV values', () => {
    const { exportData } = require('../../src/services/export-service');
    insertTestSession(db, { title: 'Title with "quotes"' });

    const csv = exportData('sessions');
    expect(csv).toContain('""quotes""');
  });
});

describe('exportSessionRoster', () => {
  it('exports roster as CSV with headers', () => {
    const { exportSessionRoster } = require('../../src/services/export-service');
    const session = insertTestSession(db);
    const player = insertTestPlayer(db, { name: 'Roster Player', email: 'roster@test.com' });
    insertTestRegistration(db, session.session_id, player.player_id, {
      char_name: 'Gandalf', char_class: 'Wizard', level: 15,
    });

    const csv = exportSessionRoster(session.session_id);
    expect(csv).toContain('Player Name');
    expect(csv).toContain('Roster Player');
    expect(csv).toContain('Gandalf');
    expect(csv).toContain('Wizard');
  });

  it('returns headers only for empty session', () => {
    const { exportSessionRoster } = require('../../src/services/export-service');
    const session = insertTestSession(db);

    const csv = exportSessionRoster(session.session_id);
    expect(csv).toContain('Player Name');
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(1); // headers only
  });
});
