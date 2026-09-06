/**
 * Tests for authentication middleware.
 *
 * The mocks mirror Express mounted-router semantics: a router mounted with
 * app.use('/api/admin', ...) sees req.path = '/sessions', req.baseUrl =
 * '/api/admin' and req.originalUrl = '/api/admin/sessions'.
 */
const http = require('http');
const express = require('express');
const { isAdmin, isApiRequest, requireAuth, requireAdmin, injectUser, getAdminEmails } = require('../../src/middleware/auth');

// Save/restore env
const originalEnv = process.env.ADMIN_EMAILS;
afterEach(() => {
  process.env.ADMIN_EMAILS = originalEnv;
});

describe('getAdminEmails', () => {
  it('parses comma-separated list', () => {
    process.env.ADMIN_EMAILS = 'admin@test.com, boss@test.com, Super@Test.COM ';
    const emails = getAdminEmails();
    expect(emails).toEqual(['admin@test.com', 'boss@test.com', 'super@test.com']);
  });

  it('returns empty array when not set', () => {
    process.env.ADMIN_EMAILS = '';
    expect(getAdminEmails()).toEqual([]);
  });
});

describe('isAdmin', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'admin@test.com,boss@test.com';
  });

  it('returns true for admin email', () => {
    expect(isAdmin({ email: 'admin@test.com' })).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAdmin({ email: 'ADMIN@TEST.COM' })).toBe(true);
  });

  it('returns false for non-admin email', () => {
    expect(isAdmin({ email: 'player@test.com' })).toBe(false);
  });

  it('returns false for null/undefined user', () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it('returns false for user without email', () => {
    expect(isAdmin({ name: 'No Email' })).toBe(false);
  });
});

/** Builds a req as seen by a router mounted at `baseUrl` for the given full URL. */
function mountedReq(originalUrl, overrides = {}) {
  const baseUrl = overrides.baseUrl ?? (originalUrl.startsWith('/api/admin') ? '/api/admin' : originalUrl.startsWith('/api') ? '/api' : '');
  const pathOnly = originalUrl.split('?')[0];
  return {
    isAuthenticated: overrides.isAuthenticated || (() => false),
    user: overrides.user || null,
    xhr: overrides.xhr || false,
    originalUrl,
    baseUrl,
    path: pathOnly.slice(baseUrl.length) || '/',
  };
}

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    redirect: jest.fn(),
  };
}

describe('isApiRequest', () => {
  it('detects API requests through a mounted router (req.path has no /api prefix)', () => {
    const req = mountedReq('/api/admin/sessions');
    expect(req.path).toBe('/sessions');
    expect(isApiRequest(req)).toBe(true);
  });

  it('detects API requests with a query string', () => {
    expect(isApiRequest(mountedReq('/api/admin/sessions?status=Scheduled'))).toBe(true);
  });

  it('treats XHR requests as API requests', () => {
    expect(isApiRequest(mountedReq('/signup', { baseUrl: '', xhr: true }))).toBe(true);
  });

  it('falls back to baseUrl + path when originalUrl is missing', () => {
    expect(isApiRequest({ baseUrl: '/api/admin', path: '/sessions' })).toBe(true);
    expect(isApiRequest({ baseUrl: '', path: '/signup' })).toBe(false);
  });

  it('returns false for non-API paths', () => {
    expect(isApiRequest(mountedReq('/signup', { baseUrl: '' }))).toBe(false);
    expect(isApiRequest(mountedReq('/apiary', { baseUrl: '' }))).toBe(false);
  });
});

describe('requireAuth', () => {
  it('calls next() for authenticated user', () => {
    const req = mountedReq('/api/me/profile', { isAuthenticated: () => true });
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 JSON for unauthenticated API request', () => {
    const req = mountedReq('/api/sessions');
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects to Google OAuth for unauthenticated page request', () => {
    const req = mountedReq('/signup', { baseUrl: '' });
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/auth/google');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'admin@test.com';
  });

  it('calls next() for authenticated admin', () => {
    const req = mountedReq('/api/admin/sessions', {
      isAuthenticated: () => true,
      user: { email: 'admin@test.com' },
    });
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 JSON (not a redirect) for unauthenticated /api/admin/* request', () => {
    const req = mountedReq('/api/admin/sessions');
    expect(req.path).toBe('/sessions'); // mounted-router semantics
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 JSON (not a redirect) for non-admin /api/admin/* request', () => {
    const req = mountedReq('/api/admin/sessions', {
      isAuthenticated: () => true,
      user: { email: 'player@test.com' },
    });
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('redirects non-admin page request', () => {
    const req = mountedReq('/admin', {
      baseUrl: '',
      isAuthenticated: () => true,
      user: { email: 'player@test.com' },
    });
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/?error=Access+Denied');
  });
});

describe('requireAdmin mounted in a real Express app', () => {
  let server;
  let baseUrl;

  function request(path, headers = {}) {
    return new Promise((resolve, reject) => {
      http.get(`${baseUrl}${path}`, { headers }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }).on('error', reject);
    });
  }

  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'admin@test.com';
  });

  beforeAll((done) => {
    const app = express();
    // Stand-in for passport: the x-test-user header decides who is logged in.
    app.use((req, res, next) => {
      const email = req.headers['x-test-user'];
      req.user = email ? { email } : undefined;
      req.isAuthenticated = () => !!req.user;
      next();
    });
    const admin = express.Router();
    admin.use(requireAdmin);
    admin.get('/sessions', (req, res) => res.json({ ok: true }));
    app.use('/api/admin', admin);
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('unauthenticated GET /api/admin/sessions gets JSON 401, not a 302 to /auth/google', async () => {
    const res = await request('/api/admin/sessions');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers.location).toBeUndefined();
    expect(JSON.parse(res.body)).toEqual({ error: 'Not authenticated' });
  });

  it('non-admin GET /api/admin/sessions gets JSON 403', async () => {
    const res = await request('/api/admin/sessions', { 'x-test-user': 'player@test.com' });
    expect(res.status).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: 'Admin access required' });
  });

  it('admin GET /api/admin/sessions succeeds', async () => {
    const res = await request('/api/admin/sessions', { 'x-test-user': 'admin@test.com' });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });
});

describe('injectUser', () => {
  it('sets res.locals for authenticated user', () => {
    process.env.ADMIN_EMAILS = 'admin@test.com';
    const req = { user: { email: 'admin@test.com', name: 'Admin' } };
    const res = { locals: {} };
    const next = jest.fn();

    injectUser(req, res, next);
    expect(res.locals.user).toBe(req.user);
    expect(res.locals.isAdmin).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  it('sets null user for unauthenticated request', () => {
    const req = {};
    const res = { locals: {} };
    const next = jest.fn();

    injectUser(req, res, next);
    expect(res.locals.user).toBeNull();
    expect(res.locals.isAdmin).toBe(false);
    expect(next).toHaveBeenCalled();
  });
});
