/**
 * Initiative tracker API with SSE broadcast.
 */
const express = require('express');
const router = express.Router();
const { getDb, generateUuid } = require('../db');
const { broadcast } = require('./api-sse');

// GET /api/initiative/:sessionId
router.get('/:sessionId', (req, res) => {
  const entries = getDb().prepare(
    'SELECT * FROM initiative_entries WHERE session_id = ? ORDER BY initiative DESC, sort_order'
  ).all(req.params.sessionId);
  res.json(entries.map(e => ({ ...e, conditions: e.conditions ? JSON.parse(e.conditions) : [] })));
});

// POST /api/initiative/:sessionId — add entry
router.post('/:sessionId', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const db = getDb();
  const { name, initiative, hp, maxHp, isNpc, playerId } = req.body;
  const id = generateUuid();
  db.prepare(`INSERT INTO initiative_entries (entry_id, session_id, name, initiative, hp, max_hp, is_npc, player_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.params.sessionId, name, parseInt(initiative,10)||0, parseInt(hp,10)||0, parseInt(maxHp,10)||0, isNpc ? 1 : 0, playerId || null);

  const entries = db.prepare('SELECT * FROM initiative_entries WHERE session_id = ? ORDER BY initiative DESC, sort_order').all(req.params.sessionId);
  broadcast(req.params.sessionId, 'initiative_update', entries);
  res.json({ success: true, entryId: id });
});

// PUT /api/initiative/entry/:entryId — update (HP, conditions, initiative)
router.put('/entry/:entryId', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const db = getDb();
  const entry = db.prepare('SELECT * FROM initiative_entries WHERE entry_id = ?').get(req.params.entryId);
  if (!entry) return res.status(404).json({ error: 'Not found' });

  const { hp, initiative, conditions, sortOrder } = req.body;
  if (hp !== undefined) db.prepare('UPDATE initiative_entries SET hp = ? WHERE entry_id = ?').run(parseInt(hp,10), req.params.entryId);
  if (initiative !== undefined) db.prepare('UPDATE initiative_entries SET initiative = ? WHERE entry_id = ?').run(parseInt(initiative,10), req.params.entryId);
  if (conditions !== undefined) db.prepare('UPDATE initiative_entries SET conditions = ? WHERE entry_id = ?').run(JSON.stringify(conditions), req.params.entryId);
  if (sortOrder !== undefined) db.prepare('UPDATE initiative_entries SET sort_order = ? WHERE entry_id = ?').run(parseInt(sortOrder,10), req.params.entryId);

  const entries = db.prepare('SELECT * FROM initiative_entries WHERE session_id = ? ORDER BY initiative DESC, sort_order').all(entry.session_id);
  broadcast(entry.session_id, 'initiative_update', entries);
  res.json({ success: true });
});

// DELETE /api/initiative/entry/:entryId
router.delete('/entry/:entryId', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const db = getDb();
  const entry = db.prepare('SELECT session_id FROM initiative_entries WHERE entry_id = ?').get(req.params.entryId);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM initiative_entries WHERE entry_id = ?').run(req.params.entryId);
  const entries = db.prepare('SELECT * FROM initiative_entries WHERE session_id = ? ORDER BY initiative DESC, sort_order').all(entry.session_id);
  broadcast(entry.session_id, 'initiative_update', entries);
  res.json({ success: true });
});

// POST /api/initiative/:sessionId/clear
router.post('/:sessionId/clear', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  getDb().prepare('DELETE FROM initiative_entries WHERE session_id = ?').run(req.params.sessionId);
  broadcast(req.params.sessionId, 'initiative_update', []);
  res.json({ success: true });
});

module.exports = router;

