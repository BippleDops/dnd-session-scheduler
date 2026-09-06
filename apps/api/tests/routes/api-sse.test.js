/**
 * Tests for the SSE hub: authentication and the per-session connection cap.
 */
const http = require('http');
const express = require('express');

process.env.SSE_MAX_CLIENTS_PER_SESSION = '2';
const sseRouter = require('../../src/routes/api-sse');

let server;
let baseUrl;
const openRequests = [];

/** Opens a request and resolves as soon as headers arrive (SSE streams stay open). */
function open(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${baseUrl}${path}`, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      resolve({
        status: res.statusCode,
        headers: res.headers,
        res,
        req,
        body: () => body,
        // Waits until at least `n` bytes have been received.
        waitForBody: (n) => new Promise((done) => {
          const check = () => { if (body.length >= n) done(body); else res.once('data', check); };
          check();
        }),
      });
    });
    req.on('error', reject);
    openRequests.push(req);
  });
}

function json(path, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

beforeAll((done) => {
  const app = express();
  app.use((req, res, next) => {
    const email = req.headers['x-test-user'];
    req.user = email ? { email } : undefined;
    req.isAuthenticated = () => !!req.user;
    next();
  });
  app.use('/api/sse', sseRouter);
  server = app.listen(0, '127.0.0.1', () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterEach(() => {
  for (const req of openRequests.splice(0)) req.destroy();
});

afterAll((done) => {
  server.closeAllConnections?.();
  server.close(done);
});

describe('GET /api/sse/:sessionId', () => {
  it('exposes the configured per-session cap', () => {
    expect(sseRouter.MAX_CLIENTS_PER_SESSION).toBe(2);
  });

  it('rejects unauthenticated clients with JSON 401', async () => {
    const res = await json('/api/sse/session-1');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not authenticated' });
  });

  it('streams events to authenticated clients and reports presence', async () => {
    const conn = await open('/api/sse/session-2', { 'x-test-user': 'player@test.com' });
    expect(conn.status).toBe(200);
    expect(conn.headers['content-type']).toMatch(/text\/event-stream/);
    const body = await conn.waitForBody(20);
    expect(body).toContain('event: connected');
    expect(body).toContain('"presence":1');
    expect(sseRouter.getPresenceCount('session-2')).toBe(1);
  });

  it('returns 429 once the per-session cap is reached and frees the slot on close', async () => {
    const headers = { 'x-test-user': 'player@test.com' };
    const a = await open('/api/sse/session-3', headers);
    const b = await open('/api/sse/session-3', headers);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(sseRouter.getPresenceCount('session-3')).toBe(2);

    const third = await json('/api/sse/session-3', headers);
    expect(third.status).toBe(429);
    expect(JSON.parse(third.body)).toEqual({ error: 'Too many open connections for this session' });

    // Other sessions are unaffected by this session's cap
    const other = await open('/api/sse/session-4', headers);
    expect(other.status).toBe(200);

    // Closing a stream frees its slot
    a.req.destroy();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(sseRouter.getPresenceCount('session-3')).toBe(1);
    const again = await open('/api/sse/session-3', headers);
    expect(again.status).toBe(200);
  });
});
