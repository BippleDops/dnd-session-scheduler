/**
 * V4 API routes: Obsidian bridge, DM prep, recap wizard, auto-briefing,
 * Foundry integration, journals, downtime, discussions, questionnaires,
 * world state, homework, scheduling, session moments.
 */
const express = require('express');
const router = express.Router();
const { getDb, generateUuid, logAction } = require('../db');
const { getPlayerByEmail } = require('../services/player-service');
const { requireAdmin } = require('../middleware/auth');

// ══════════════════════════════════════════════════════
// Module 1: Obsidian Vault Bridge
// ══════════════════════════════════════════════════════

// GET /api/admin/sessions/:id/prep — DM prep notes
router.get('/admin/sessions/:id/prep', requireAdmin, (req, res) => {
  const db = getDb();
  const prep = db.prepare('SELECT * FROM session_prep WHERE session_id = ?').get(req.params.id);
  res.json(prep || { session_id: req.params.id, previously_on: '', key_npcs: '', scenes_planned: '', secrets: '', possible_loot: '', dm_teaser: '', foundry_scene: '', map_screenshot_url: '' });
});

// PUT /api/admin/sessions/:id/prep — Save DM prep notes
router.put('/admin/sessions/:id/prep', requireAdmin, (req, res) => {
  const db = getDb();
  const { previouslyOn, keyNpcs, scenesPlanned, secrets, possibleLoot, dmTeaser, foundryScene, mapScreenshotUrl } = req.body;
  db.prepare(`INSERT INTO session_prep (session_id, previously_on, key_npcs, scenes_planned, secrets, possible_loot, dm_teaser, foundry_scene, map_screenshot_url, modified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(session_id) DO UPDATE SET previously_on=?, key_npcs=?, scenes_planned=?, secrets=?, possible_loot=?, dm_teaser=?, foundry_scene=?, map_screenshot_url=?, modified_at=datetime('now')`)
    .run(req.params.id, previouslyOn||'', keyNpcs||'', scenesPlanned||'', secrets||'', possibleLoot||'', dmTeaser||'', foundryScene||'', mapScreenshotUrl||'',
      previouslyOn||'', keyNpcs||'', scenesPlanned||'', secrets||'', possibleLoot||'', dmTeaser||'', foundryScene||'', mapScreenshotUrl||'');
  logAction('PREP_UPDATED', `Prep notes updated for session ${req.params.id}`, req.user.email, req.params.id);
  res.json({ success: true });
});

// POST /api/admin/sessions/:id/notes — Import markdown (from Obsidian)
router.post('/admin/sessions/:id/notes', requireAdmin, (req, res) => {
  const db = getDb();
  const { markdown } = req.body;
  if (!markdown) return res.status(400).json({ error: 'Markdown content required' });
  // Store as dm_post_notes in session_history
  const existing = db.prepare('SELECT * FROM session_history WHERE session_id = ?').get(req.params.id);
  if (existing) {
    db.prepare('UPDATE session_history SET dm_post_notes = ? WHERE session_id = ?').run(markdown, req.params.id);
  } else {
    db.prepare('INSERT INTO session_history (session_id, dm_post_notes) VALUES (?, ?)').run(req.params.id, markdown);
  }
  logAction('NOTES_IMPORTED', `Markdown notes imported for session ${req.params.id}`, req.user.email, req.params.id);
  res.json({ success: true });
});

// GET /api/admin/sessions/:id/notes?format=md — Export as clean markdown
router.get('/admin/sessions/:id/notes', requireAdmin, (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(req.params.id);
  const history = db.prepare('SELECT * FROM session_history WHERE session_id = ?').get(req.params.id);
  const prep = db.prepare('SELECT * FROM session_prep WHERE session_id = ?').get(req.params.id);
  const regs = db.prepare(`SELECT r.*, p.name as player_name FROM registrations r JOIN players p ON r.player_id = p.player_id WHERE r.session_id = ? AND r.status IN ('Confirmed','Attended')`).all(req.params.id);
  const loot = db.prepare('SELECT * FROM loot WHERE session_id = ?').all(req.params.id);
  const journals = db.prepare(`SELECT cj.*, c.name as char_name FROM character_journals cj JOIN characters c ON cj.character_id = c.character_id WHERE cj.session_id = ?`).all(req.params.id);
  const moments = db.prepare('SELECT * FROM session_moments WHERE session_id = ? ORDER BY timestamp').all(req.params.id);

  if (!session) return res.status(404).json({ error: 'Session not found' });

  const players = regs.map(r => r.player_name);
  const characters = regs.map(r => r.char_name_snapshot);

  // Build YAML frontmatter + markdown
  let md = `---\ndate: ${session.date}\ncampaign: ${session.campaign}\n`;
  md += `players: [${players.join(', ')}]\n`;
  md += `characters: [${characters.join(', ')}]\n`;
  md += `status: ${session.status}\n`;
  if (session.level_tier && session.level_tier !== 'any') md += `tier: ${session.level_tier}\n`;
  md += `---\n\n`;
  md += `## ${session.title || 'Untitled Session'}\n\n`;

  if (history?.dm_post_notes) md += `### Recap\n\n${history.dm_post_notes}\n\n`;

  if (moments.length > 0) {
    md += `### Key Moments\n\n`;
    moments.forEach(m => { md += `- **${m.type}** (${m.timestamp}): ${m.description}\n`; });
    md += `\n`;
  }

  if (loot.length > 0) {
    md += `### Loot Awarded\n\n`;
    loot.forEach(l => { md += `- **${l.item_name}** (${l.rarity})${l.description ? ` — ${l.description}` : ''}\n`; });
    md += `\n`;
  }

  if (journals.length > 0) {
    md += `### Player Journals\n\n`;
    journals.forEach(j => { md += `#### ${j.char_name}: ${j.title || 'Untitled'}\n\n${j.content}\n\n`; });
  }

  if (req.query.format === 'md') {
    res.set('Content-Type', 'text/markdown');
    res.set('Content-Disposition', `attachment; filename="${session.campaign}-${session.date}.md"`);
    return res.send(md);
  }
  res.json({ markdown: md, session, history, prep, loot, moments, journals });
});

// GET /api/admin/obsidian/export/:campaignSlug — Full campaign export
router.get('/admin/obsidian/export/:campaignSlug', requireAdmin, (req, res) => {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE slug = ?').get(req.params.campaignSlug);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const sessions = db.prepare(`SELECT s.*, h.dm_post_notes FROM sessions s LEFT JOIN session_history h ON s.session_id = h.session_id WHERE s.campaign = ? ORDER BY s.date`).all(campaign.name);
  const worldState = db.prepare('SELECT * FROM world_state WHERE campaign_id = ? ORDER BY changed_at').all(campaign.campaign_id);

  // Build campaign index
  let index = `---\ncampaign: ${campaign.name}\n---\n\n# ${campaign.name}\n\n`;
  if (campaign.description) index += `${campaign.description}\n\n`;
  if (campaign.lore) index += `## World Lore\n\n${campaign.lore}\n\n`;
  if (campaign.house_rules) index += `## House Rules\n\n${campaign.house_rules}\n\n`;

  if (worldState.length > 0) {
    index += `## World State\n\n`;
    worldState.forEach(ws => { index += `- **${ws.fact}**: ${ws.value}\n`; });
    index += `\n`;
  }

  index += `## Sessions\n\n`;
  sessions.forEach(s => { index += `- [[${s.date} - ${s.title || 'Untitled'}]] (${s.status})\n`; });

  const files = [{ path: `${campaign.name}/00 - Campaign Index.md`, content: index }];
  sessions.forEach(s => {
    let md = `---\ndate: ${s.date}\ncampaign: ${campaign.name}\nstatus: ${s.status}\n---\n\n`;
    md += `## ${s.title || 'Untitled Session'}\n\n`;
    if (s.dm_post_notes) md += `${s.dm_post_notes}\n\n`;
    files.push({ path: `${campaign.name}/${s.date} - ${s.title || 'Untitled'}.md`, content: md });
  });

  res.json({ campaign: campaign.name, files });
});

// ══════════════════════════════════════════════════════
// Module 2: Pre-Session Autopilot
// ══════════════════════════════════════════════════════

// GET /api/admin/sessions/:id/checklist
router.get('/admin/sessions/:id/checklist', requireAdmin, (req, res) => {
  const db = getDb();
  let checklist = db.prepare('SELECT * FROM session_checklists WHERE session_id = ?').get(req.params.id);
  if (!checklist) {
    // Auto-populate checklist from current state
    const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(req.params.id);
    const prevSession = db.prepare(`SELECT s.session_id FROM sessions s LEFT JOIN session_history h ON s.session_id = h.session_id WHERE s.campaign = ? AND s.date < ? ORDER BY s.date DESC LIMIT 1`).get(session?.campaign, session?.date);
    const prevHistory = prevSession ? db.prepare('SELECT * FROM session_history WHERE session_id = ?').get(prevSession.session_id) : null;
    const prep = db.prepare('SELECT * FROM session_prep WHERE session_id = ?').get(req.params.id);
    checklist = {
      session_id: req.params.id,
      recap_written: prevHistory?.dm_post_notes ? 1 : 0,
      attendance_confirmed: 0, characters_leveled: 0,
      foundry_loaded: 0, prep_reviewed: prep ? 1 : 0,
      loot_prepared: 0, music_set: 0,
    };
  }
  res.json(checklist);
});

// PUT /api/admin/sessions/:id/checklist
router.put('/admin/sessions/:id/checklist', requireAdmin, (req, res) => {
  const db = getDb();
  const fields = ['recap_written','attendance_confirmed','characters_leveled','foundry_loaded','prep_reviewed','loot_prepared','music_set'];
  const vals = fields.map(f => req.body[f] ? 1 : 0);
  db.prepare(`INSERT INTO session_checklists (session_id, ${fields.join(',')}, modified_at)
    VALUES (?, ${fields.map(() => '?').join(',')}, datetime('now'))
    ON CONFLICT(session_id) DO UPDATE SET ${fields.map(f => `${f}=?`).join(',')}, modified_at=datetime('now')`)
    .run(req.params.id, ...vals, ...vals);
  res.json({ success: true });
});

// Availability Polls
router.get('/polls', (req, res) => {
  const db = getDb();
  const polls = db.prepare(`SELECT p.*, c.name as campaign_name FROM availability_polls p LEFT JOIN campaigns c ON p.campaign_id = c.campaign_id ORDER BY p.created_at DESC LIMIT 20`).all();
  res.json(polls.map(p => ({ ...p, options: JSON.parse(p.options || '[]') })));
});

router.post('/admin/polls', requireAdmin, (req, res) => {
  const { campaignId, title, options } = req.body;
  if (!title || !options?.length) return res.status(400).json({ error: 'Title and options required' });
  const id = generateUuid();
  getDb().prepare('INSERT INTO availability_polls (poll_id, campaign_id, title, options, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, campaignId || null, title, JSON.stringify(options), req.user.email);
  res.json({ success: true, pollId: id });
});

router.post('/polls/:id/vote', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const { selectedOptions } = req.body;
  const id = generateUuid();
  getDb().prepare('INSERT OR REPLACE INTO availability_votes (vote_id, poll_id, player_id, selected_options) VALUES (?, ?, ?, ?)')
    .run(id, req.params.id, player.player_id, JSON.stringify(selectedOptions || []));
  res.json({ success: true });
});

router.get('/polls/:id', (req, res) => {
  const db = getDb();
  const poll = db.prepare('SELECT * FROM availability_polls WHERE poll_id = ?').get(req.params.id);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  const votes = db.prepare(`SELECT v.*, p.name as player_name FROM availability_votes v JOIN players p ON v.player_id = p.player_id WHERE v.poll_id = ?`).all(req.params.id);
  res.json({ ...poll, options: JSON.parse(poll.options || '[]'), votes: votes.map(v => ({ ...v, selected_options: JSON.parse(v.selected_options || '[]') })) });
});

// ══════════════════════════════════════════════════════
// Module 3: Foundry + Session Moments
// ══════════════════════════════════════════════════════

// Session moments
router.get('/sessions/:id/moments', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM session_moments WHERE session_id = ? ORDER BY timestamp').all(req.params.id));
});

router.post('/admin/sessions/:id/moments', requireAdmin, (req, res) => {
  const { type, description } = req.body;
  if (!type || !description) return res.status(400).json({ error: 'Type and description required' });
  const id = generateUuid();
  getDb().prepare('INSERT INTO session_moments (moment_id, session_id, type, description) VALUES (?, ?, ?, ?)')
    .run(id, req.params.id, type, description);
  // Broadcast via SSE
  try { const { broadcast } = require('./api-sse'); broadcast(req.params.id, 'moment', { moment_id: id, type, description, timestamp: new Date().toISOString() }); } catch {}
  res.json({ success: true, momentId: id });
});

router.delete('/admin/moments/:id', requireAdmin, (req, res) => {
  getDb().prepare('DELETE FROM session_moments WHERE moment_id = ?').run(req.params.id);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════
// Module 4: Player Engagement
// ══════════════════════════════════════════════════════

// Character journals
router.get('/characters/:charId/journals', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM character_journals WHERE character_id = ? ORDER BY created_at DESC').all(req.params.charId));
});

router.post('/me/characters/:charId/journals', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const { title, content, sessionId } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const id = generateUuid();
  getDb().prepare('INSERT INTO character_journals (journal_id, character_id, player_id, session_id, title, content) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.charId, player.player_id, sessionId || null, title || '', content.slice(0, 10000));
  res.json({ success: true, journalId: id });
});

router.put('/admin/journals/:id/comment', requireAdmin, (req, res) => {
  getDb().prepare('UPDATE character_journals SET dm_comment = ? WHERE journal_id = ?').run(req.body.comment || '', req.params.id);
  res.json({ success: true });
});

// Downtime actions
router.get('/me/downtime', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.json([]);
  res.json(getDb().prepare(`SELECT d.*, c.name as character_name FROM downtime_actions d JOIN characters c ON d.character_id = c.character_id WHERE d.player_id = ? ORDER BY d.created_at DESC`).all(player.player_id));
});

router.post('/me/downtime', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const { characterId, campaignId, type, description, goal, duration } = req.body;
  if (!characterId || !type || !description) return res.status(400).json({ error: 'Character, type, and description required' });
  const id = generateUuid();
  getDb().prepare('INSERT INTO downtime_actions (action_id, character_id, player_id, campaign_id, type, description, goal, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, characterId, player.player_id, campaignId || null, type, description.slice(0, 2000), goal || '', duration || '');
  res.json({ success: true, actionId: id });
});

router.get('/admin/downtime', requireAdmin, (req, res) => {
  const status = req.query.status || 'Pending';
  res.json(getDb().prepare(`SELECT d.*, c.name as character_name, p.name as player_name FROM downtime_actions d JOIN characters c ON d.character_id = c.character_id JOIN players p ON d.player_id = p.player_id WHERE d.status = ? ORDER BY d.created_at`).all(status));
});

router.put('/admin/downtime/:id', requireAdmin, (req, res) => {
  const { status, dmNotes, reward } = req.body;
  getDb().prepare('UPDATE downtime_actions SET status = ?, dm_notes = ?, reward = ?, resolved_at = datetime(\'now\') WHERE action_id = ?')
    .run(status || 'Resolved', dmNotes || '', reward || '', req.params.id);
  logAction('DOWNTIME_RESOLVED', `Downtime ${req.params.id} resolved: ${status}`, req.user.email, req.params.id);
  res.json({ success: true });
});

// Discussion boards
router.get('/campaigns/:slug/discussions', (req, res) => {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE slug = ?').get(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const threads = db.prepare(`SELECT t.*, p.name as author_name, p.photo_url as author_photo,
    (SELECT COUNT(*) FROM discussion_posts WHERE thread_id = t.thread_id) as post_count,
    (SELECT MAX(created_at) FROM discussion_posts WHERE thread_id = t.thread_id) as last_post_at
    FROM discussion_threads t JOIN players p ON t.player_id = p.player_id
    WHERE t.campaign_id = ? ORDER BY t.pinned DESC, COALESCE(last_post_at, t.created_at) DESC`).all(campaign.campaign_id);
  res.json(threads);
});

router.post('/campaigns/:slug/discussions', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE slug = ?').get(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  const threadId = generateUuid();
  const postId = generateUuid();
  db.prepare('INSERT INTO discussion_threads (thread_id, campaign_id, player_id, title) VALUES (?, ?, ?, ?)').run(threadId, campaign.campaign_id, player.player_id, title);
  db.prepare('INSERT INTO discussion_posts (post_id, thread_id, player_id, content) VALUES (?, ?, ?, ?)').run(postId, threadId, player.player_id, content.slice(0, 5000));
  res.json({ success: true, threadId });
});

router.get('/discussions/:threadId', (req, res) => {
  const db = getDb();
  const thread = db.prepare(`SELECT t.*, p.name as author_name FROM discussion_threads t JOIN players p ON t.player_id = p.player_id WHERE t.thread_id = ?`).get(req.params.threadId);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  const posts = db.prepare(`SELECT dp.*, p.name as author_name, p.photo_url as author_photo FROM discussion_posts dp JOIN players p ON dp.player_id = p.player_id WHERE dp.thread_id = ? ORDER BY dp.created_at`).all(req.params.threadId);
  res.json({ ...thread, posts });
});

router.post('/discussions/:threadId/reply', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const thread = getDb().prepare('SELECT * FROM discussion_threads WHERE thread_id = ?').get(req.params.threadId);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  if (thread.locked) return res.status(403).json({ error: 'Thread is locked' });
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const id = generateUuid();
  getDb().prepare('INSERT INTO discussion_posts (post_id, thread_id, player_id, content) VALUES (?, ?, ?, ?)').run(id, req.params.threadId, player.player_id, content.slice(0, 5000));
  res.json({ success: true, postId: id });
});

router.put('/admin/discussions/:threadId', requireAdmin, (req, res) => {
  const { pinned, locked } = req.body;
  const db = getDb();
  if (pinned !== undefined) db.prepare('UPDATE discussion_threads SET pinned = ? WHERE thread_id = ?').run(pinned ? 1 : 0, req.params.threadId);
  if (locked !== undefined) db.prepare('UPDATE discussion_threads SET locked = ? WHERE thread_id = ?').run(locked ? 1 : 0, req.params.threadId);
  res.json({ success: true });
});

// Questionnaires
router.get('/admin/questionnaires', requireAdmin, (req, res) => {
  res.json(getDb().prepare(`SELECT q.*, c.name as campaign_name FROM questionnaires q LEFT JOIN campaigns c ON q.campaign_id = c.campaign_id ORDER BY q.created_at DESC`).all().map(q => ({ ...q, questions: JSON.parse(q.questions || '[]') })));
});

router.post('/admin/questionnaires', requireAdmin, (req, res) => {
  const { campaignId, title, questions } = req.body;
  if (!title || !questions?.length) return res.status(400).json({ error: 'Title and questions required' });
  const id = generateUuid();
  getDb().prepare('INSERT INTO questionnaires (questionnaire_id, campaign_id, title, questions, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, campaignId || null, title, JSON.stringify(questions), req.user.email);
  res.json({ success: true, questionnaireId: id });
});

router.get('/questionnaires/:id', (req, res) => {
  const q = getDb().prepare('SELECT * FROM questionnaires WHERE questionnaire_id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  res.json({ ...q, questions: JSON.parse(q.questions || '[]') });
});

router.post('/questionnaires/:id/respond', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const { answers } = req.body;
  const id = generateUuid();
  getDb().prepare('INSERT INTO questionnaire_responses (response_id, questionnaire_id, player_id, answers) VALUES (?, ?, ?, ?)')
    .run(id, req.params.id, player.player_id, JSON.stringify(answers || {}));
  res.json({ success: true });
});

router.get('/admin/questionnaires/:id/responses', requireAdmin, (req, res) => {
  const responses = getDb().prepare(`SELECT r.*, p.name as player_name FROM questionnaire_responses r JOIN players p ON r.player_id = p.player_id WHERE r.questionnaire_id = ? ORDER BY r.created_at`).all(req.params.id);
  res.json(responses.map(r => ({ ...r, answers: JSON.parse(r.answers || '{}') })));
});

// ══════════════════════════════════════════════════════
// Module 5: Post-Session Flow
// ══════════════════════════════════════════════════════

// World state
router.get('/campaigns/:slug/world-state', (req, res) => {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE slug = ?').get(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const states = db.prepare(`SELECT ws.*, s.date as session_date, s.title as session_title FROM world_state ws LEFT JOIN sessions s ON ws.changed_session_id = s.session_id WHERE ws.campaign_id = ? ORDER BY ws.changed_at DESC`).all(campaign.campaign_id);
  res.json(states);
});

router.post('/admin/campaigns/:campaignId/world-state', requireAdmin, (req, res) => {
  const { fact, value, sessionId } = req.body;
  if (!fact || !value) return res.status(400).json({ error: 'Fact and value required' });
  const id = generateUuid();
  getDb().prepare('INSERT INTO world_state (state_id, campaign_id, fact, value, changed_session_id) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.params.campaignId, fact, value, sessionId || null);
  logAction('WORLD_STATE_UPDATED', `${fact}: ${value}`, req.user.email, req.params.campaignId);
  res.json({ success: true, stateId: id });
});

// Homework progress
router.get('/me/homework', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.json([]);
  res.json(getDb().prepare(`SELECT h.*, s.date, s.campaign, s.title FROM homework_progress h JOIN sessions s ON h.session_id = s.session_id WHERE h.player_id = ? ORDER BY s.date DESC LIMIT 5`).all(player.player_id));
});

router.put('/me/homework/:sessionId', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const fields = ['recap_read','journal_written','downtime_submitted','character_updated'];
  const updates = {};
  for (const f of fields) { if (req.body[f] !== undefined) updates[f] = req.body[f] ? 1 : 0; }
  const db = getDb();
  // Upsert
  db.prepare(`INSERT INTO homework_progress (player_id, session_id, ${Object.keys(updates).join(',')})
    VALUES (?, ?, ${Object.values(updates).join(',')})
    ON CONFLICT(player_id, session_id) DO UPDATE SET ${Object.keys(updates).map(k => `${k}=?`).join(',')}`)
    .run(player.player_id, req.params.sessionId, ...Object.values(updates));
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════
// Module 6: Smart Scheduling
// ══════════════════════════════════════════════════════

// Session requests
router.get('/session-requests', (req, res) => {
  const requests = getDb().prepare(`SELECT sr.*, p.name as player_name, p.photo_url, c.name as campaign_name,
    (SELECT COUNT(*) FROM session_request_votes WHERE request_id = sr.request_id) as vote_count
    FROM session_requests sr JOIN players p ON sr.player_id = p.player_id
    LEFT JOIN campaigns c ON sr.campaign_id = c.campaign_id
    WHERE sr.status = 'Open' ORDER BY vote_count DESC, sr.created_at DESC`).all();
  res.json(requests);
});

router.post('/me/session-requests', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const { campaignId, preferredDate, message } = req.body;
  const id = generateUuid();
  getDb().prepare('INSERT INTO session_requests (request_id, campaign_id, player_id, preferred_date, message) VALUES (?, ?, ?, ?, ?)')
    .run(id, campaignId || null, player.player_id, preferredDate || '', message || '');
  res.json({ success: true, requestId: id });
});

router.post('/session-requests/:id/vote', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const { availableDates } = req.body;
  getDb().prepare('INSERT OR REPLACE INTO session_request_votes (request_id, player_id, available_dates) VALUES (?, ?, ?)')
    .run(req.params.id, player.player_id, JSON.stringify(availableDates || []));
  // Update upvote count
  const count = getDb().prepare('SELECT COUNT(*) as c FROM session_request_votes WHERE request_id = ?').get(req.params.id);
  getDb().prepare('UPDATE session_requests SET upvotes = ? WHERE request_id = ?').run((count?.c || 0) + 1, req.params.id);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════
// V7: Character Goals & Relationships
// ══════════════════════════════════════════════════════

router.get('/characters/:id/goals', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM character_goals WHERE character_id = ? ORDER BY status, created_at DESC').all(req.params.id));
});

router.post('/me/characters/:id/goals', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const player = getPlayerByEmail(req.user.email);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const { title, description, type } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const id = generateUuid();
  getDb().prepare('INSERT INTO character_goals (goal_id, character_id, title, description, type) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.params.id, title, description || '', type || 'short');
  res.json({ success: true, goalId: id });
});

router.put('/admin/goals/:id', requireAdmin, (req, res) => {
  const { status, reward } = req.body;
  const updates = [];
  const params = [];
  if (status) { updates.push('status = ?'); params.push(status); }
  if (reward !== undefined) { updates.push('reward = ?'); params.push(reward); }
  if (status === 'completed') { updates.push("completed_at = datetime('now')"); }
  if (updates.length === 0) return res.json({ success: false });
  params.push(req.params.id);
  getDb().prepare(`UPDATE character_goals SET ${updates.join(', ')} WHERE goal_id = ?`).run(...params);
  res.json({ success: true });
});

router.get('/characters/:id/relationships', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM character_relationships WHERE character_id = ? ORDER BY disposition, target_name').all(req.params.id));
});

router.post('/me/characters/:id/relationships', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  const { targetName, targetType, disposition, description } = req.body;
  if (!targetName) return res.status(400).json({ error: 'Target name required' });
  const id = generateUuid();
  getDb().prepare('INSERT INTO character_relationships (relationship_id, character_id, target_name, target_type, disposition, description) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.id, targetName, targetType || 'npc', disposition || 'neutral', description || '');
  res.json({ success: true, relationshipId: id });
});

router.delete('/me/characters/relationships/:id', (req, res) => {
  if (!req.user?.email) return res.status(401).json({ error: 'Not authenticated' });
  getDb().prepare('DELETE FROM character_relationships WHERE relationship_id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;

