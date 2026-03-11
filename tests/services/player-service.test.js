/**
 * Tests for player-service.js
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

describe('getPlayerByEmail', () => {
  it('returns a player by email', () => {
    const { getPlayerByEmail } = require('../../src/services/player-service');
    insertTestPlayer(db, { email: 'hero@test.com', name: 'Hero' });

    const player = getPlayerByEmail('hero@test.com');
    expect(player).toBeTruthy();
    expect(player.name).toBe('Hero');
  });

  it('is case-insensitive', () => {
    const { getPlayerByEmail } = require('../../src/services/player-service');
    insertTestPlayer(db, { email: 'hero@test.com' });

    // The function lowercases the email before querying
    const player = getPlayerByEmail('HERO@TEST.COM');
    // This depends on whether SQLite stores it lowercased too
    // The test player helper inserts as-is, so this tests the query
    expect(player).toBeTruthy();
  });

  it('returns null for nonexistent email', () => {
    const { getPlayerByEmail } = require('../../src/services/player-service');
    expect(getPlayerByEmail('nobody@test.com')).toBeUndefined();
  });

  it('returns null for empty/null email', () => {
    const { getPlayerByEmail } = require('../../src/services/player-service');
    expect(getPlayerByEmail(null)).toBeNull();
    expect(getPlayerByEmail('')).toBeNull();
  });
});

describe('getPlayerById', () => {
  it('returns a player by ID', () => {
    const { getPlayerById } = require('../../src/services/player-service');
    const player = insertTestPlayer(db, { name: 'Bob' });

    const result = getPlayerById(player.player_id);
    expect(result).toBeTruthy();
    expect(result.name).toBe('Bob');
  });

  it('returns undefined for nonexistent ID', () => {
    const { getPlayerById } = require('../../src/services/player-service');
    expect(getPlayerById('nonexistent')).toBeUndefined();
  });
});

describe('upsertPlayer', () => {
  it('creates a new player', () => {
    const { upsertPlayer } = require('../../src/services/player-service');
    const result = upsertPlayer({
      name: 'New Player',
      email: 'new@test.com',
      playedBefore: 'no',
    });

    expect(result.isNew).toBe(true);
    expect(result.playerId).toBeDefined();

    const row = db.prepare('SELECT * FROM players WHERE player_id = ?').get(result.playerId);
    expect(row.name).toBe('New Player');
    expect(row.email).toBe('new@test.com');
    expect(row.active_status).toBe('Active');
  });

  it('updates an existing player', () => {
    const { upsertPlayer } = require('../../src/services/player-service');
    const existing = insertTestPlayer(db, { email: 'existing@test.com', name: 'Old Name' });

    const result = upsertPlayer({
      email: 'existing@test.com',
      name: 'New Name',
      preferredCampaign: 'Aethermoor',
    });

    expect(result.isNew).toBe(false);
    expect(result.playerId).toBe(existing.player_id);

    const row = db.prepare('SELECT * FROM players WHERE player_id = ?').get(existing.player_id);
    expect(row.name).toBe('New Name');
    expect(row.preferred_campaign).toBe('Aethermoor');
  });

  it('lowercases email on creation', () => {
    const { upsertPlayer } = require('../../src/services/player-service');
    const result = upsertPlayer({ name: 'Test', email: 'UPPER@TEST.COM' });
    const row = db.prepare('SELECT email FROM players WHERE player_id = ?').get(result.playerId);
    expect(row.email).toBe('upper@test.com');
  });
});

describe('setPlayerStatus', () => {
  it('sets a player to Inactive', () => {
    const { setPlayerStatus } = require('../../src/services/player-service');
    const player = insertTestPlayer(db);

    const result = setPlayerStatus(player.player_id, 'Inactive');
    expect(result.success).toBe(true);

    const row = db.prepare('SELECT active_status FROM players WHERE player_id = ?').get(player.player_id);
    expect(row.active_status).toBe('Inactive');
  });

  it('rejects invalid status', () => {
    const { setPlayerStatus } = require('../../src/services/player-service');
    const player = insertTestPlayer(db);

    const result = setPlayerStatus(player.player_id, 'Banned');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('returns error for nonexistent player', () => {
    const { setPlayerStatus } = require('../../src/services/player-service');
    const result = setPlayerStatus('nonexistent', 'Active');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('updatePlayerRecord', () => {
  it('updates player fields with sanitization', () => {
    const { updatePlayerRecord } = require('../../src/services/player-service');
    const player = insertTestPlayer(db);

    const result = updatePlayerRecord(player.player_id, {
      name: 'Sanitized <script>alert(1)</script> Name',
      preferredCampaign: 'Aethermoor',
    });

    expect(result.success).toBe(true);
    const row = db.prepare('SELECT name, preferred_campaign FROM players WHERE player_id = ?').get(player.player_id);
    expect(row.name).not.toContain('<script>');
    expect(row.preferred_campaign).toBe('Aethermoor');
  });

  it('returns error for nonexistent player', () => {
    const { updatePlayerRecord } = require('../../src/services/player-service');
    const result = updatePlayerRecord('nonexistent', { name: 'X' });
    expect(result.success).toBe(false);
  });
});

describe('getPlayerCharactersByEmail', () => {
  it('returns distinct characters from registrations', () => {
    const { getPlayerCharactersByEmail } = require('../../src/services/player-service');
    const player = insertTestPlayer(db, { email: 'chars@test.com' });
    const s1 = insertTestSession(db);
    const s2 = insertTestSession(db);

    insertTestRegistration(db, s1.session_id, player.player_id, { char_name: 'Gandalf', char_class: 'Wizard' });
    insertTestRegistration(db, s2.session_id, player.player_id, { char_name: 'Aragorn', char_class: 'Ranger' });

    const chars = getPlayerCharactersByEmail('chars@test.com');
    expect(chars.length).toBe(2);
    const names = chars.map(c => c.characterName);
    expect(names).toContain('Gandalf');
    expect(names).toContain('Aragorn');
  });

  it('returns empty array for unknown email', () => {
    const { getPlayerCharactersByEmail } = require('../../src/services/player-service');
    expect(getPlayerCharactersByEmail('nobody@test.com')).toEqual([]);
  });

  it('returns empty array for null email', () => {
    const { getPlayerCharactersByEmail } = require('../../src/services/player-service');
    expect(getPlayerCharactersByEmail(null)).toEqual([]);
  });
});

describe('getAllPlayersAdmin', () => {
  it('returns all players with stats', () => {
    const { getAllPlayersAdmin } = require('../../src/services/player-service');
    insertTestPlayer(db, { name: 'Alice' });
    insertTestPlayer(db, { name: 'Bob' });

    const players = getAllPlayersAdmin();
    expect(players.length).toBe(2);
    expect(players[0]).toHaveProperty('PlayerID');
    expect(players[0]).toHaveProperty('totalRegistrations');
    expect(players[0]).toHaveProperty('sessionsAttended');
  });

  it('filters by status', () => {
    const { getAllPlayersAdmin } = require('../../src/services/player-service');
    const p1 = insertTestPlayer(db, { name: 'Active Player' });
    const p2 = insertTestPlayer(db, { name: 'Inactive Player' });
    db.prepare("UPDATE players SET active_status = 'Inactive' WHERE player_id = ?").run(p2.player_id);

    const active = getAllPlayersAdmin({ status: 'Active' });
    expect(active.length).toBe(1);
    expect(active[0].Name).toBe('Active Player');
  });
});

describe('getPlayerContacts', () => {
  it('returns only active players', () => {
    const { getPlayerContacts } = require('../../src/services/player-service');
    const p1 = insertTestPlayer(db, { name: 'Active' });
    const p2 = insertTestPlayer(db, { name: 'Inactive' });
    db.prepare("UPDATE players SET active_status = 'Inactive' WHERE player_id = ?").run(p2.player_id);

    const contacts = getPlayerContacts();
    expect(contacts.length).toBe(1);
    expect(contacts[0].name).toBe('Active');
    expect(contacts[0]).toHaveProperty('id');
  });
});
