/**
 * Server-Sent Events (SSE) hub.
 * Clients connect per-session to receive real-time dice rolls, initiative updates, and presence.
 */
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Upper bound on simultaneously open streams per game session. Each open
// stream pins a socket and a heartbeat timer, so this must be bounded.
const MAX_CLIENTS_PER_SESSION = Math.max(1, parseInt(process.env.SSE_MAX_CLIENTS_PER_SESSION, 10) || 50);
const HEARTBEAT_MS = 30000;

// In-memory client registry: sessionId -> Set of response objects
const clients = new Map();

function addClient(sessionId, res) {
  if (!clients.has(sessionId)) clients.set(sessionId, new Set());
  clients.get(sessionId).add(res);
}

function removeClient(sessionId, res) {
  const set = clients.get(sessionId);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(sessionId);
  }
}

function broadcast(sessionId, event, data) {
  const set = clients.get(sessionId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    res.write(payload);
  }
}

function getPresenceCount(sessionId) {
  return clients.has(sessionId) ? clients.get(sessionId).size : 0;
}

// SSE endpoint: GET /api/sse/:sessionId (authenticated users only)
router.get('/:sessionId', requireAuth, (req, res) => {
  const { sessionId } = req.params;

  if (getPresenceCount(sessionId) >= MAX_CLIENTS_PER_SESSION) {
    return res.status(429).json({ error: 'Too many open connections for this session' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  addClient(sessionId, res);

  // Send initial connection event, then broadcast the updated presence
  res.write(`event: connected\ndata: ${JSON.stringify({ sessionId, presence: getPresenceCount(sessionId) })}\n\n`);
  broadcast(sessionId, 'presence', { count: getPresenceCount(sessionId) });

  // Heartbeat to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(sessionId, res);
    broadcast(sessionId, 'presence', { count: getPresenceCount(sessionId) });
  });
});

module.exports = router;
module.exports.broadcast = broadcast;
module.exports.getPresenceCount = getPresenceCount;
module.exports.MAX_CLIENTS_PER_SESSION = MAX_CLIENTS_PER_SESSION;
