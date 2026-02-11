/**
 * V3 API routes: loot, player recaps, messages, achievements, analytics, public profiles.
 */
const express = require('express');
const router = express.Router();
const { getDb, generateUuid, logAction } = require('../db');
const { getPlayerByEmail } = require('../services/player-service');

// ── Loot (Admin) ──
router.post('/admin/loot', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const db = getDb();
  const { sessionId, characterId, itemName, description, rarity, quantity, goldValue } = req.body;
  if (!itemName) return res.status(400).json({ error: 'Item name required' });
  const id = generateUuid();
  db.prepare(`INSERT INTO loot (loot_id, session_id, character_id, item_name, description, rarity, quantity, gold_value, awarded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, sessionId||null, characterId||null, itemName, description||'', rarity||'Common', parseInt(quantity,10)||1, parseInt(goldValue,10)||0, req.user.email);
  logAction('LOOT_AWARDED', `${itemName} awarded`, req.user.email, id);
  res.json({ success: true, lootId: id });
});

// Admin gold adjustment
router.put('/admin/characters/:id/gold', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const db = getDb();
  const { gold, silver, copper } = req.body;
  db.prepare('UPDATE characters SET gold = COALESCE(gold,0)+?, silver = COALESCE(silver,0)+?, copper = COALESCE(copper,0)+?, modified_at = datetime(\'now\') WHERE character_id = ?')
    .run(parseInt(gold,10)||0, parseInt(silver,10)||0, parseInt(copper,10)||0, req.params.id);
  logAction('GOLD_ADJUSTED', `Gold adjusted for ${req.params.id}`, req.user.email, req.params.id);
  res.json({ success: true });
});

// ── Player Recaps ──
router.get('/sessions/:sessionId/player-recaps', (req, res) => {
  const recaps = getDb().prepare(`
    SELECT pr.*, p.name as player_name FROM player_recaps pr
    JOIN players p ON pr.player_id = p.player_id
    WHERE pr.session_id = ? ORDER BY pr.created_at
  `).all(req.params.sessionId);
  res.json(recaps);
});

router.post('/sessions/:sessionId/player-recaps', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const { content } = req.body;
  if (!content || content.trim().length === 0) return res.status(400).json({ error: 'Content required' });
  const id = generateUuid();
  getDb().prepare('INSERT INTO player_recaps (recap_id, session_id, player_id, content) VALUES (?, ?, ?, ?)')
    .run(id, req.params.sessionId, player.player_id, content.slice(0, 5000));
  res.json({ success: true, recapId: id });
});

// ── Messages ──
router.get('/me/messages', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.json([]);
  const messages = getDb().prepare(`
    SELECT m.*, fp.name as from_name, tp.name as to_name FROM messages m
    JOIN players fp ON m.from_player_id = fp.player_id
    JOIN players tp ON m.to_player_id = tp.player_id
    WHERE m.to_player_id = ? OR m.from_player_id = ?
    ORDER BY m.created_at DESC LIMIT 50
  `).all(player.player_id, player.player_id);
  res.json(messages);
});

router.post('/me/messages', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const { toPlayerId, subject, body } = req.body;
  if (!toPlayerId || !body) return res.status(400).json({ error: 'Recipient and body required' });
  const id = generateUuid();
  getDb().prepare('INSERT INTO messages (message_id, from_player_id, to_player_id, subject, body) VALUES (?, ?, ?, ?, ?)')
    .run(id, player.player_id, toPlayerId, subject || '', body.slice(0, 2000));
  res.json({ success: true });
});

router.post('/me/messages/:id/read', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.json({ success: false });
  getDb().prepare('UPDATE messages SET read = 1 WHERE message_id = ? AND to_player_id = ?').run(req.params.id, player.player_id);
  res.json({ success: true });
});

// ── Achievements ──
router.get('/me/achievements', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.json([]);
  const achievements = getDb().prepare(`
    SELECT a.*, pa.earned_at FROM achievements a
    LEFT JOIN player_achievements pa ON a.achievement_id = pa.achievement_id AND pa.player_id = ?
    ORDER BY pa.earned_at DESC NULLS LAST
  `).all(player.player_id);
  res.json(achievements);
});

// ── Player Public Profile ──
router.get('/players/:id', (req, res) => {
  const db = getDb();
  const player = db.prepare('SELECT player_id, name, photo_url FROM players WHERE player_id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const characters = db.prepare("SELECT * FROM characters WHERE player_id = ? AND status = 'Active' ORDER BY name").all(req.params.id);
  const sessions = db.prepare('SELECT COUNT(DISTINCT r.session_id) as count FROM registrations r WHERE r.player_id = ?').get(req.params.id);
  const campaigns = db.prepare(`SELECT DISTINCT s.campaign FROM registrations r JOIN sessions s ON r.session_id = s.session_id WHERE r.player_id = ?`).all(req.params.id);
  const achievements = db.prepare(`SELECT a.*, pa.earned_at FROM achievements a JOIN player_achievements pa ON a.achievement_id = pa.achievement_id WHERE pa.player_id = ?`).all(req.params.id);
  res.json({ ...player, characters, session_count: sessions?.count || 0, campaigns: campaigns.map(c => c.campaign), achievements });
});

// ── Player Stats ──
router.get('/me/stats', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.json({});
  const db = getDb();
  const total = db.prepare("SELECT COUNT(*) as c FROM registrations WHERE player_id = ? AND status = 'registered'").get(player.player_id);
  const attended = db.prepare('SELECT COUNT(*) as c FROM registrations WHERE player_id = ? AND attendance_confirmed = 1').get(player.player_id);
  const campaignDist = db.prepare(`SELECT s.campaign, COUNT(*) as count FROM registrations r JOIN sessions s ON r.session_id = s.session_id WHERE r.player_id = ? GROUP BY s.campaign`).all(player.player_id);
  const mostPlayed = db.prepare(`SELECT char_name_snapshot, COUNT(*) as c FROM registrations WHERE player_id = ? GROUP BY char_name_snapshot ORDER BY c DESC LIMIT 1`).get(player.player_id);
  res.json({
    totalSessions: total?.c || 0,
    attendanceRate: total?.c > 0 ? Math.round((attended?.c || 0) / total.c * 100) : 0,
    streak: 0,
    campaignDistribution: campaignDist,
    levelProgression: [],
    mostPlayedCharacter: mostPlayed?.char_name_snapshot || 'None',
  });
});

// ── Admin Analytics ──
router.get('/admin/analytics', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const db = getDb();
  const sessionsPerMonth = db.prepare(`SELECT strftime('%Y-%m', date) as month, COUNT(*) as count FROM sessions GROUP BY month ORDER BY month DESC LIMIT 12`).all();
  const avgAtt = db.prepare(`SELECT AVG(cnt) as avg FROM (SELECT COUNT(*) as cnt FROM registrations WHERE status = 'registered' GROUP BY session_id)`).get();
  const campaignDist = db.prepare(`SELECT campaign, COUNT(*) as count FROM sessions GROUP BY campaign ORDER BY count DESC`).all();
  const busiest = db.prepare(`SELECT strftime('%w', date) as dow, COUNT(*) as count FROM sessions GROUP BY dow ORDER BY count DESC LIMIT 1`).get();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const topPlayers = db.prepare(`SELECT p.name, COUNT(r.reg_id) as sessions FROM registrations r JOIN players p ON r.player_id = p.player_id WHERE r.status = 'registered' GROUP BY p.player_id ORDER BY sessions DESC LIMIT 10`).all();
  const totalPlayers = db.prepare('SELECT COUNT(*) as c FROM players').get();
  const activePlayers = db.prepare("SELECT COUNT(DISTINCT player_id) as c FROM registrations WHERE created_at > datetime('now', '-90 days')").get();
  res.json({
    sessionsPerMonth: sessionsPerMonth.reverse(),
    avgAttendance: Math.round(avgAtt?.avg || 0),
    campaignDistribution: campaignDist,
    busiestDay: busiest ? days[parseInt(busiest.dow)] : 'N/A',
    playerRetention: totalPlayers?.c > 0 ? Math.round((activePlayers?.c || 0) / totalPlayers.c * 100) : 0,
    topPlayers,
  });
});

module.exports = router;

