/**
 * Dice rolling API with SSE broadcast.
 */
const express = require('express');
const router = express.Router();
const { getDb, generateUuid } = require('../db');
const { getPlayerByEmail } = require('../services/player-service');
const { broadcast } = require('./api-sse');

// Parse dice expression: "2d6+3", "1d20", "4d8-2", "d100"
function parseDice(expression) {
  const match = expression.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  const count = parseInt(match[1], 10) || 1;
  const sides = parseInt(match[2], 10);
  const modifier = parseInt(match[3], 10) || 0;
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  return { count, sides, modifier };
}

function rollDice(count, sides) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}

// POST /api/dice/roll
router.post('/roll', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  const { expression, sessionId } = req.body;
  if (!expression) return res.status(400).json({ error: 'Missing expression' });

  const parsed = parseDice(expression);
  if (!parsed) return res.status(400).json({ error: 'Invalid dice expression. Use format: NdM+X (e.g., 2d6+3, 1d20, d100)' });

  const results = rollDice(parsed.count, parsed.sides);
  const total = results.reduce((a, b) => a + b, 0) + parsed.modifier;

  const db = getDb();
  const rollId = generateUuid();
  db.prepare(`INSERT INTO dice_rolls (roll_id, session_id, player_id, expression, results, total)
    VALUES (?, ?, ?, ?, ?, ?)`).run(rollId, sessionId || null, player.player_id, expression, JSON.stringify(results), total);

  const rollData = {
    roll_id: rollId,
    player_id: player.player_id,
    player_name: player.name,
    expression,
    results,
    total,
    modifier: parsed.modifier,
    created_at: new Date().toISOString(),
  };

  // Broadcast to session if specified
  if (sessionId) {
    broadcast(sessionId, 'dice_roll', rollData);
  }

  res.json({ success: true, ...rollData });
});

// GET /api/dice/history/:sessionId
router.get('/history/:sessionId', (req, res) => {
  const db = getDb();
  const rolls = db.prepare(`
    SELECT d.*, p.name as player_name FROM dice_rolls d
    LEFT JOIN players p ON d.player_id = p.player_id
    WHERE d.session_id = ?
    ORDER BY d.created_at DESC LIMIT 50
  `).all(req.params.sessionId);
  res.json(rolls.map(r => ({ ...r, results: JSON.parse(r.results || '[]') })));
});

module.exports = router;

