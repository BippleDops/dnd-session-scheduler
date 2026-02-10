/**
 * Authentication middleware.
 * Replaces GAS Session.getActiveUser() + isAdmin().
 */

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Checks if the authenticated user is an admin. */
function isAdmin(user) {
  if (!user || !user.email) return false;
  return getAdminEmails().includes(user.email.toLowerCase());
}

/** Middleware: requires any authenticated user. */
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.redirect('/auth/google');
}

/** Middleware: requires an admin user. */
function requireAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
    return res.redirect('/auth/google');
  }
  if (!isAdmin(req.user)) {
    if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Admin access required' });
    return res.redirect('/?error=Access+Denied');
  }
  next();
}

/** Injects user/admin info into res.locals for templates. */
function injectUser(req, res, next) {
  res.locals.user = req.user || null;
  res.locals.isAdmin = req.user ? isAdmin(req.user) : false;
  res.locals.baseUrl = process.env.BASE_URL || '';
  next();
}

module.exports = { isAdmin, requireAuth, requireAdmin, injectUser, getAdminEmails };

