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
      done(null, {
        id: profile.id,
        name: profile.displayName,
        email: email.toLowerCase(),
        photo: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
      });
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

