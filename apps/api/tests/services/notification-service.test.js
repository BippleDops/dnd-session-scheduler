/**
 * Tests for notification-service.js
 */
const { setupDbMock, closeTestDb, insertTestPlayer } = require('../helpers/setup-db');

let db;

beforeEach(() => {
  jest.resetModules();
  db = setupDbMock();
});

afterEach(() => {
  closeTestDb();
  jest.restoreAllMocks();
});

describe('createNotification', () => {
  it('creates a notification', () => {
    const { createNotification } = require('../../src/services/notification-service');
    const player = insertTestPlayer(db);

    createNotification(player.player_id, 'registration', 'You signed up!', 'reg-123');

    const row = db.prepare('SELECT * FROM notifications WHERE player_id = ?').get(player.player_id);
    expect(row).toBeTruthy();
    expect(row.type).toBe('registration');
    expect(row.message).toBe('You signed up!');
    expect(row.read).toBe(0);
  });
});

describe('getUnreadNotifications', () => {
  it('returns unread notifications', () => {
    const { createNotification, getUnreadNotifications } = require('../../src/services/notification-service');
    const player = insertTestPlayer(db);

    createNotification(player.player_id, 'type1', 'Message 1');
    createNotification(player.player_id, 'type2', 'Message 2');

    const unread = getUnreadNotifications(player.player_id);
    expect(unread.length).toBe(2);
  });

  it('excludes read notifications', () => {
    const { createNotification, getUnreadNotifications, markAllRead } = require('../../src/services/notification-service');
    const player = insertTestPlayer(db);

    createNotification(player.player_id, 'type1', 'Message 1');
    markAllRead(player.player_id);
    createNotification(player.player_id, 'type2', 'Message 2');

    const unread = getUnreadNotifications(player.player_id);
    expect(unread.length).toBe(1);
    expect(unread[0].message).toBe('Message 2');
  });

  it('limits to 20 notifications', () => {
    const { createNotification, getUnreadNotifications } = require('../../src/services/notification-service');
    const player = insertTestPlayer(db);

    for (let i = 0; i < 25; i++) {
      createNotification(player.player_id, 'type', `Message ${i}`);
    }

    const unread = getUnreadNotifications(player.player_id);
    expect(unread.length).toBe(20);
  });
});

describe('getUnreadCount', () => {
  it('returns correct count', () => {
    const { createNotification, getUnreadCount } = require('../../src/services/notification-service');
    const player = insertTestPlayer(db);

    createNotification(player.player_id, 'a', 'M1');
    createNotification(player.player_id, 'b', 'M2');
    createNotification(player.player_id, 'c', 'M3');

    expect(getUnreadCount(player.player_id)).toBe(3);
  });
});

describe('markRead', () => {
  it('marks a single notification as read', () => {
    const { createNotification, markRead, getUnreadCount } = require('../../src/services/notification-service');
    const player = insertTestPlayer(db);

    createNotification(player.player_id, 'type', 'Read me');
    const notif = db.prepare('SELECT notification_id FROM notifications WHERE player_id = ?').get(player.player_id);

    markRead(notif.notification_id, player.player_id);
    expect(getUnreadCount(player.player_id)).toBe(0);
  });

  it('does not mark another player notification as read', () => {
    const { createNotification, markRead, getUnreadCount } = require('../../src/services/notification-service');
    const player1 = insertTestPlayer(db);
    const player2 = insertTestPlayer(db);

    createNotification(player1.player_id, 'type', 'P1 message');
    const notif = db.prepare('SELECT notification_id FROM notifications WHERE player_id = ?').get(player1.player_id);

    markRead(notif.notification_id, player2.player_id);
    expect(getUnreadCount(player1.player_id)).toBe(1); // still unread
  });
});

describe('markAllRead', () => {
  it('marks all notifications as read for a player', () => {
    const { createNotification, markAllRead, getUnreadCount } = require('../../src/services/notification-service');
    const player = insertTestPlayer(db);

    createNotification(player.player_id, 'a', 'M1');
    createNotification(player.player_id, 'b', 'M2');

    markAllRead(player.player_id);
    expect(getUnreadCount(player.player_id)).toBe(0);
  });
});
