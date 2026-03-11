/**
 * Tests for character-service.js
 */
const { setupDbMock, closeTestDb, insertTestPlayer, insertTestSession, insertTestRegistration } = require('../helpers/setup-db');

let db;

beforeEach(() => {
  jest.resetModules();
  db = setupDbMock();
  jest.mock('../../src/services/achievement-engine', () => ({
    evaluateAchievements: jest.fn(),
  }), { virtual: true });
});

afterEach(() => {
  closeTestDb();
  jest.restoreAllMocks();
});

describe('createCharacter', () => {
  it('creates a character with all fields', () => {
    const { createCharacter } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);

    const result = createCharacter(player.player_id, {
      name: 'Thorn Ironforge',
      class: 'Fighter',
      subclass: 'Champion',
      level: '5',
      race: 'Dwarf',
      backstory: 'A brave warrior',
      ac: '18',
      str: '16',
      dex: '12',
      con: '14',
      int: '10',
      wis: '13',
      cha: '8',
    });

    expect(result.success).toBe(true);
    expect(result.characterId).toBeDefined();

    const row = db.prepare('SELECT * FROM characters WHERE character_id = ?').get(result.characterId);
    expect(row.name).toBe('Thorn Ironforge');
    expect(row.class).toBe('Fighter');
    expect(row.level).toBe(5);
    expect(row.race).toBe('Dwarf');
    expect(row.ac).toBe(18);
    expect(row.str).toBe(16);
    expect(row.status).toBe('Active');
  });

  it('defaults level to 1 and AC to 10', () => {
    const { createCharacter } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);

    const result = createCharacter(player.player_id, { name: 'Noob' });
    const row = db.prepare('SELECT level, ac FROM characters WHERE character_id = ?').get(result.characterId);
    expect(row.level).toBe(1);
    expect(row.ac).toBe(10);
  });
});

describe('getCharactersByPlayer', () => {
  it('returns only active characters', () => {
    const { createCharacter, getCharactersByPlayer, retireCharacter } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);

    const c1 = createCharacter(player.player_id, { name: 'Active Hero' });
    const c2 = createCharacter(player.player_id, { name: 'Retired Hero' });
    retireCharacter(c2.characterId, player.player_id);

    const chars = getCharactersByPlayer(player.player_id);
    expect(chars.length).toBe(1);
    expect(chars[0].name).toBe('Active Hero');
  });
});

describe('getCharacterById', () => {
  it('returns the character', () => {
    const { createCharacter, getCharacterById } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);
    const { characterId } = createCharacter(player.player_id, { name: 'Lookup Test' });

    const char = getCharacterById(characterId);
    expect(char).toBeTruthy();
    expect(char.name).toBe('Lookup Test');
  });

  it('returns undefined for nonexistent', () => {
    const { getCharacterById } = require('../../src/services/character-service');
    expect(getCharacterById('nonexistent')).toBeUndefined();
  });
});

describe('updateCharacter', () => {
  it('updates fields', () => {
    const { createCharacter, updateCharacter, getCharacterById } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);
    const { characterId } = createCharacter(player.player_id, { name: 'Before', level: '3' });

    const result = updateCharacter(characterId, player.player_id, {
      name: 'After',
      level: '7',
      ac: '15',
    });

    expect(result.success).toBe(true);
    const char = getCharacterById(characterId);
    expect(char.name).toBe('After');
    expect(char.level).toBe(7);
    expect(char.ac).toBe(15);
  });

  it('rejects update for wrong player', () => {
    const { createCharacter, updateCharacter } = require('../../src/services/character-service');
    const player1 = insertTestPlayer(db);
    const player2 = insertTestPlayer(db);
    const { characterId } = createCharacter(player1.player_id, { name: 'Mine' });

    const result = updateCharacter(characterId, player2.player_id, { name: 'Stolen' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('retireCharacter', () => {
  it('sets status to Retired', () => {
    const { createCharacter, retireCharacter, getCharacterById } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);
    const { characterId } = createCharacter(player.player_id, { name: 'Retiring' });

    retireCharacter(characterId, player.player_id);
    const char = getCharacterById(characterId);
    expect(char.status).toBe('Retired');
  });
});

describe('awardXP', () => {
  it('levels up based on 300 XP per level', () => {
    const { createCharacter, awardXP, getCharacterById } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);
    const { characterId } = createCharacter(player.player_id, { name: 'XP Test', level: '5' });

    const result = awardXP(characterId, 600); // +2 levels
    expect(result.success).toBe(true);
    expect(result.newLevel).toBe(7);

    const char = getCharacterById(characterId);
    expect(char.level).toBe(7);
  });

  it('caps at level 20', () => {
    const { createCharacter, awardXP } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);
    const { characterId } = createCharacter(player.player_id, { name: 'Max Level', level: '19' });

    const result = awardXP(characterId, 6000);
    expect(result.newLevel).toBe(20);
  });

  it('returns failure for nonexistent character', () => {
    const { awardXP } = require('../../src/services/character-service');
    const result = awardXP('nonexistent', 300);
    expect(result.success).toBe(false);
  });

  it('does not level up for less than 300 XP', () => {
    const { createCharacter, awardXP, getCharacterById } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);
    const { characterId } = createCharacter(player.player_id, { name: 'Partial XP', level: '5' });

    awardXP(characterId, 299);
    const char = getCharacterById(characterId);
    expect(char.level).toBe(5); // unchanged
  });
});

describe('sanitizeUrl (via portrait_url)', () => {
  it('accepts HTTPS URLs', () => {
    const { createCharacter, getCharacterById } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);
    const { characterId } = createCharacter(player.player_id, {
      name: 'HTTPS',
      portraitUrl: 'https://example.com/portrait.png',
    });

    const char = getCharacterById(characterId);
    expect(char.portrait_url).toBe('https://example.com/portrait.png');
  });

  it('rejects HTTP URLs', () => {
    const { createCharacter, getCharacterById } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);
    const { characterId } = createCharacter(player.player_id, {
      name: 'HTTP',
      portraitUrl: 'http://example.com/portrait.png',
    });

    const char = getCharacterById(characterId);
    expect(char.portrait_url).toBe('');
  });

  it('rejects javascript: URIs', () => {
    const { createCharacter, getCharacterById } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);
    const { characterId } = createCharacter(player.player_id, {
      name: 'XSS',
      portraitUrl: 'javascript:alert(1)',
    });

    const char = getCharacterById(characterId);
    expect(char.portrait_url).toBe('');
  });
});

describe('getCharacterLoot', () => {
  it('returns loot for a character', () => {
    const { createCharacter, getCharacterLoot } = require('../../src/services/character-service');
    const player = insertTestPlayer(db);
    const session = insertTestSession(db);
    const { characterId } = createCharacter(player.player_id, { name: 'Looter' });

    const crypto = require('crypto');
    db.prepare(`INSERT INTO loot (loot_id, session_id, character_id, item_name, rarity) VALUES (?, ?, ?, ?, ?)`)
      .run(crypto.randomUUID(), session.session_id, characterId, 'Magic Sword', 'Rare');

    const loot = getCharacterLoot(characterId);
    expect(loot.length).toBe(1);
    expect(loot[0].item_name).toBe('Magic Sword');
  });
});
