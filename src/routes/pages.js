/**
 * Page routes — serves EJS templates.
 * Replaces GAS doGet() routing.
 */
const express = require('express');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── Public pages ──
router.get('/', (req, res) => res.render('index', { currentPage: '' }));
router.get('/sessions', (req, res) => res.render('sessions', { currentPage: 'sessions' }));
router.get('/signup', (req, res) => res.render('signup', { currentPage: 'signup', sessionId: req.query.sessionId || '' }));
router.get('/my-sessions', (req, res) => res.render('my-sessions', { currentPage: 'my-sessions' }));
router.get('/profile', (req, res) => res.render('profile', { currentPage: 'profile' }));
router.get('/cancel', (req, res) => res.render('cancel', { currentPage: 'cancel', token: req.query.token || '' }));
router.get('/recaps', (req, res) => res.render('recaps', { currentPage: 'recaps' }));

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

