/**
 * Google OAuth 2.0 authentication routes.
 * Replaces GAS Session.getActiveUser().
 */
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const router = express.Router();

// ── Passport setup ──

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

function initPassport() {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : '';
      const photo = profile.photos && profile.photos[0] ? profile.photos[0].value : '';
      const name = profile.displayName || '';

      // Auto-create player record on first login (A1 onboarding)
      try {
        const { getDb, generateUuid, nowTimestamp } = require('../db');
        const db = getDb();
        const existing = db.prepare('SELECT player_id, photo_url FROM players WHERE email = ?').get(email.toLowerCase());
        if (!existing) {
          db.prepare(`INSERT INTO players (player_id, name, email, photo_url, registered_at, active_status)
            VALUES (?, ?, ?, ?, datetime('now'), 'Active')`).run(generateUuid(), name, email.toLowerCase(), photo);
        } else if (photo && !existing.photo_url) {
          db.prepare('UPDATE players SET photo_url = ? WHERE player_id = ?').run(photo, existing.player_id);
        }
      } catch (e) { console.error('Auto-create player error:', e.message); }

      done(null, { id: profile.id, name, email: email.toLowerCase(), photo });
    }
  ));
}

// ── Routes ──

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account',
}));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=Login+failed' }),
  (req, res) => {
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  }
);

router.get('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

module.exports = { router, initPassport };

