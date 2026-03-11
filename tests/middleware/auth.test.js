/**
 * Tests for authentication middleware.
 */
const { isAdmin, requireAuth, requireAdmin, injectUser, getAdminEmails } = require('../../src/middleware/auth');

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

describe('requireAuth', () => {
  function mockReqRes(overrides = {}) {
    const req = {
      isAuthenticated: overrides.isAuthenticated || (() => false),
      xhr: overrides.xhr || false,
      path: overrides.path || '/',
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
    };
    const next = jest.fn();
    return { req, res, next };
  }

  it('calls next() for authenticated user', () => {
    const { req, res, next } = mockReqRes({ isAuthenticated: () => true });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 JSON for unauthenticated API request', () => {
    const { req, res, next } = mockReqRes({ path: '/api/sessions' });
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects to Google OAuth for unauthenticated page request', () => {
    const { req, res, next } = mockReqRes({ path: '/signup' });
    requireAuth(req, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/auth/google');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'admin@test.com';
  });

  function mockReqRes(overrides = {}) {
    const req = {
      isAuthenticated: overrides.isAuthenticated || (() => false),
      user: overrides.user || null,
      path: overrides.path || '/api/admin/sessions',
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
    };
    const next = jest.fn();
    return { req, res, next };
  }

  it('calls next() for authenticated admin', () => {
    const { req, res, next } = mockReqRes({
      isAuthenticated: () => true,
      user: { email: 'admin@test.com' },
    });
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated API request', () => {
    const { req, res, next } = mockReqRes();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 for non-admin API request', () => {
    const { req, res, next } = mockReqRes({
      isAuthenticated: () => true,
      user: { email: 'player@test.com' },
    });
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
  });

  it('redirects non-admin page request', () => {
    const { req, res, next } = mockReqRes({
      isAuthenticated: () => true,
      user: { email: 'player@test.com' },
      path: '/admin',
    });
    requireAdmin(req, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/?error=Access+Denied');
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
