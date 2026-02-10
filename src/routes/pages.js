/**
 * Page routes — serves EJS templates.
 * Replaces GAS doGet() routing.
 */
const express = require('express');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const { getPlayerByEmail } = require('../services/player-service');

const router = express.Router();

/**
 * Middleware: checks if the logged-in user has completed their profile.
 * Redirects to /profile if name or playedBefore are missing.
 * Skips for pages that don't require a complete profile.
 */
function requireCompleteProfile(req, res, next) {
  if (!req.user || !req.user.email) return next(); // not logged in — let the page handle it
  const player = getPlayerByEmail(req.user.email);
  if (!player) return next(); // no player record yet — signup will create one
  if (!player.name || !player.played_before) {
    return res.redirect('/profile?complete=1');
  }
  next();
}

// ── Public pages (no login required) ──
router.get('/', (req, res) => res.render('index', { currentPage: '' }));
router.get('/sessions', (req, res) => res.render('sessions', { currentPage: 'sessions' }));
router.get('/recaps', (req, res) => res.render('recaps', { currentPage: 'recaps' }));
router.get('/cancel', (req, res) => res.render('cancel', { currentPage: 'cancel', token: req.query.token || '' }));

// ── Requires login ──
router.get('/signup', requireAuth, requireCompleteProfile, (req, res) => res.render('signup', { currentPage: 'signup', sessionId: req.query.sessionId || '' }));
router.get('/my-sessions', requireAuth, (req, res) => res.render('my-sessions', { currentPage: 'my-sessions' }));
router.get('/profile', requireAuth, (req, res) => res.render('profile', { currentPage: 'profile', needsCompletion: req.query.complete === '1' }));

// ── Admin pages ──
router.get('/admin', requireAdmin, (req, res) => res.render('admin-dashboard', { currentPage: 'admin' }));
router.get('/admin-sessions', requireAdmin, (req, res) => res.render('admin-sessions', {
  currentPage: 'admin-sessions', action: req.query.action || '', sessionId: req.query.sessionId || '',
}));
router.get('/admin-players', requireAdmin, (req, res) => res.render('admin-players', { currentPage: 'admin-players' }));
router.get('/admin-history', requireAdmin, (req, res) => res.render('admin-history', { currentPage: 'admin-history' }));
router.get('/admin-config', requireAdmin, (req, res) => res.render('admin-config', { currentPage: 'admin-config' }));
router.get('/admin-logs', requireAdmin, (req, res) => res.render('admin-logs', { currentPage: 'admin-logs' }));

module.exports = router;

