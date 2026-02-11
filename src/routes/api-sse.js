/**
 * Server-Sent Events (SSE) hub.
 * Clients connect per-session to receive real-time dice rolls, initiative updates, and presence.
 */
const express = require('express');
const router = express.Router();

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

// SSE endpoint: GET /api/sse/:sessionId
router.get('/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ sessionId, presence: getPresenceCount(sessionId) + 1 })}\n\n`);

  addClient(sessionId, res);

  // Broadcast updated presence
  broadcast(sessionId, 'presence', { count: getPresenceCount(sessionId) });

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(sessionId, res);
    broadcast(sessionId, 'presence', { count: getPresenceCount(sessionId) });
  });
});

module.exports = router;
module.exports.broadcast = broadcast;
module.exports.getPresenceCount = getPresenceCount;

