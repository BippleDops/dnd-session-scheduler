/**
 * In-app notification service.
 */
const { getDb, generateUuid } = require('../db');

function createNotification(playerId, type, message, relatedId = '') {
  const db = getDb();
  db.prepare(`INSERT INTO notifications (notification_id, player_id, type, message, related_id, read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`).run(generateUuid(), playerId, type, message, relatedId);
}

function getUnreadNotifications(playerId) {
  return getDb().prepare(`SELECT * FROM notifications WHERE player_id = ? AND read = 0 ORDER BY created_at DESC LIMIT 20`).all(playerId);
}

function getUnreadCount(playerId) {
  return getDb().prepare(`SELECT COUNT(*) AS c FROM notifications WHERE player_id = ? AND read = 0`).get(playerId).c;
}

function markRead(notificationId, playerId) {
  getDb().prepare(`UPDATE notifications SET read = 1 WHERE notification_id = ? AND player_id = ?`).run(notificationId, playerId);
}

function markAllRead(playerId) {
  getDb().prepare(`UPDATE notifications SET read = 1 WHERE player_id = ? AND read = 0`).run(playerId);
}

module.exports = { createNotification, getUnreadNotifications, getUnreadCount, markRead, markAllRead };

