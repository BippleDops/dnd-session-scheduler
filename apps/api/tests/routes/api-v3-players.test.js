/**
 * Tests for GET /api/players/:id (api-v3): authentication and field visibility.
 */
const http = require('http');
const express = require('express');
const { setupDbMock, closeTestDb, insertTestPlayer } = require('../helpers/setup-db');

let db;
let server;
let baseUrl;

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, json: body ? JSON.parse(body) : null }));
    }).on('error', reject);
  });
}

beforeEach((done) => {
  jest.resetModules();
  process.env.ADMIN_EMAILS = 'admin@test.com';
  db = setupDbMock();
  const router = require('../../src/routes/api-v3');

  const app = express();
  app.use((req, res, next) => {
    const email = req.headers['x-test-user'];
    req.user = email ? { email } : undefined;
    req.isAuthenticated = () => !!req.user;
    next();
  });
  app.use('/api', router);
  server = app.listen(0, '127.0.0.1', () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterEach((done) => {
  closeTestDb();
  server.close(done);
});

describe('GET /api/players/:id', () => {
  it('requires authentication (JSON 401)', async () => {
    const player = insertTestPlayer(db);
    const res = await get(`/api/players/${player.player_id}`);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Not authenticated' });
  });

  it('returns 404 for an unknown player', async () => {
    const res = await get('/api/players/does-not-exist', { 'x-test-user': 'someone@test.com' });
    expect(res.status).toBe(404);
  });

  it('returns only name and photo to other authenticated players', async () => {
    const player = insertTestPlayer(db, { name: 'Thorn', email: 'thorn@test.com' });
    db.prepare("INSERT INTO characters (character_id, player_id, name, class, level) VALUES ('c1', ?, 'Thorn the Bold', 'Fighter', 5)").run(player.player_id);

    const res = await get(`/api/players/${player.player_id}`, { 'x-test-user': 'other@test.com' });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ player_id: player.player_id, name: 'Thorn', photo_url: null });
    expect(res.json).not.toHaveProperty('email');
    expect(res.json).not.toHaveProperty('characters');
    expect(res.json).not.toHaveProperty('achievements');
  });

  it('returns the full profile to the player themself (without email)', async () => {
    const player = insertTestPlayer(db, { name: 'Thorn', email: 'thorn@test.com' });
    db.prepare("INSERT INTO characters (character_id, player_id, name, class, level) VALUES ('c1', ?, 'Thorn the Bold', 'Fighter', 5)").run(player.player_id);

    const res = await get(`/api/players/${player.player_id}`, { 'x-test-user': 'Thorn@Test.com' });
    expect(res.status).toBe(200);
    expect(res.json.name).toBe('Thorn');
    expect(res.json.characters).toHaveLength(1);
    expect(res.json.characters[0].name).toBe('Thorn the Bold');
    expect(res.json.session_count).toBe(0);
    expect(res.json.campaigns).toEqual([]);
    expect(res.json.achievements).toEqual([]);
    expect(res.json).not.toHaveProperty('email');
  });

  it('returns the full profile to admins', async () => {
    const player = insertTestPlayer(db, { name: 'Thorn', email: 'thorn@test.com' });
    const res = await get(`/api/players/${player.player_id}`, { 'x-test-user': 'admin@test.com' });
    expect(res.status).toBe(200);
    expect(res.json).toHaveProperty('characters');
    expect(res.json).toHaveProperty('achievements');
  });
});
