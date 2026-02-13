/**
 * Achievement evaluation engine.
 * Checks and awards achievements based on player activity.
 */
const { getDb, logAction } = require('../db');
const { createNotification } = require('./notification-service');

const ACHIEVEMENT_CHECKS = {
  'first-session': (db, playerId) => {
    const count = db.prepare("SELECT COUNT(*) as c FROM registrations WHERE player_id = ? AND status = 'Attended'").get(playerId);
    return count.c >= 1;
  },
  'ten-sessions': (db, playerId) => {
    const count = db.prepare("SELECT COUNT(*) as c FROM registrations WHERE player_id = ? AND status = 'Attended'").get(playerId);
    return count.c >= 10;
  },
  'hundred-sessions': (db, playerId) => {
    const count = db.prepare("SELECT COUNT(*) as c FROM registrations WHERE player_id = ? AND status = 'Attended'").get(playerId);
    return count.c >= 100;
  },
  'perfect-attendance': (db, playerId) => {
    const total = db.prepare("SELECT COUNT(*) as c FROM registrations WHERE player_id = ? AND status IN ('Attended','No-Show')").get(playerId);
    if (total.c < 3) return false; // need at least 3 sessions to qualify
    const noShows = db.prepare("SELECT COUNT(*) as c FROM registrations WHERE player_id = ? AND status = 'No-Show'").get(playerId);
    return noShows.c === 0;
  },
  'level-20': (db, playerId) => {
    const char = db.prepare("SELECT 1 FROM characters WHERE player_id = ? AND level >= 20 AND status = 'Active' LIMIT 1").get(playerId);
    return !!char;
  },
  'multi-campaign': (db, playerId) => {
    const count = db.prepare(`
      SELECT COUNT(DISTINCT s.campaign) as c
      FROM registrations r JOIN sessions s ON r.session_id = s.session_id
      WHERE r.player_id = ? AND r.status IN ('Confirmed','Attended')
    `).get(playerId);
    return count.c >= 3;
  },
  'first-character': (db, playerId) => {
    const count = db.prepare("SELECT COUNT(*) as c FROM characters WHERE player_id = ?").get(playerId);
    return count.c >= 1;
  },
};

/**
 * Evaluate all achievements for a player and award any newly earned ones.
 * Returns array of newly awarded achievement keys.
 */
function evaluateAchievements(playerId) {
  const db = getDb();
  const newlyEarned = [];

  // Get all achievements and which ones the player already has
  const achievements = db.prepare('SELECT * FROM achievements').all();
  const earned = new Set(
    db.prepare('SELECT a.key FROM achievements a JOIN player_achievements pa ON a.achievement_id = pa.achievement_id WHERE pa.player_id = ?')
      .all(playerId).map(r => r.key)
  );

  for (const achievement of achievements) {
    if (earned.has(achievement.key)) continue;

    const checker = ACHIEVEMENT_CHECKS[achievement.key];
    if (!checker) continue;

    try {
      if (checker(db, playerId)) {
        // Award it
        db.prepare('INSERT OR IGNORE INTO player_achievements (player_id, achievement_id) VALUES (?, ?)')
          .run(playerId, achievement.achievement_id);

        newlyEarned.push(achievement);

        // Notify the player (in-app)
        createNotification(
          playerId, 'achievement',
          `🏆 Achievement Unlocked: ${achievement.icon} ${achievement.name} — ${achievement.description}`,
          achievement.achievement_id
        );

        // Send achievement email (async, best-effort)
        try {
          const { sendEmail, playerWantsEmail } = require('./reminder-service');
          const { buildAchievementEmail } = require('../email/templates');
          if (playerWantsEmail(playerId, 'achievements')) {
            const player = db.prepare('SELECT name, email FROM players WHERE player_id = ?').get(playerId);
            if (player?.email) {
              sendEmail(player.email, `🏆 Achievement Unlocked: ${achievement.name}`, buildAchievementEmail(player.name, achievement))
                .catch(e => console.error('Achievement email error:', e.message));
            }
          }
        } catch {}

        logAction('ACHIEVEMENT_EARNED', `${achievement.name} earned by ${playerId}`, 'System', achievement.achievement_id);
      }
    } catch (e) {
      console.error(`Achievement check error for ${achievement.key}:`, e.message);
    }
  }

  return newlyEarned;
}

module.exports = { evaluateAchievements };
