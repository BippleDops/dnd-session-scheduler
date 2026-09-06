/**
 * Tests for src/config/secrets.js
 */
const {
  getSessionSecret, getLinkSigningSecret, PLACEHOLDER_SECRET, DEV_FALLBACK_SECRET,
} = require('../../src/config/secrets');

const STRONG = 'a'.repeat(64);

let warnSpy;
beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('getSessionSecret in production', () => {
  const prod = (extra) => ({ NODE_ENV: 'production', ...extra });

  it('throws when SESSION_SECRET is missing', () => {
    expect(() => getSessionSecret(prod({}))).toThrow(/SESSION_SECRET is not set/);
  });

  it('throws when SESSION_SECRET is empty', () => {
    expect(() => getSessionSecret(prod({ SESSION_SECRET: '' }))).toThrow(/SESSION_SECRET/);
  });

  it('throws when SESSION_SECRET is still the env.example placeholder', () => {
    expect(() => getSessionSecret(prod({ SESSION_SECRET: PLACEHOLDER_SECRET }))).toThrow(/placeholder/);
  });

  it('returns the configured secret', () => {
    expect(getSessionSecret(prod({ SESSION_SECRET: STRONG }))).toBe(STRONG);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('accepts but warns about a short secret', () => {
    expect(getSessionSecret(prod({ SESSION_SECRET: 'short' }))).toBe('short');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/shorter than 32/));
  });
});

describe('getSessionSecret in development', () => {
  it('returns a stable fallback and warns loudly when SESSION_SECRET is missing', () => {
    const env = { NODE_ENV: 'development' };
    expect(getSessionSecret(env)).toBe(DEV_FALLBACK_SECRET);
    expect(getSessionSecret(env)).toBe(DEV_FALLBACK_SECRET); // stable across calls / restarts
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/INSECURE development fallback/));
  });

  it('uses the configured secret without warning when it is strong', () => {
    expect(getSessionSecret({ SESSION_SECRET: STRONG })).toBe(STRONG);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('uses a short configured secret but warns', () => {
    expect(getSessionSecret({ SESSION_SECRET: 'short' })).toBe('short');
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('getLinkSigningSecret', () => {
  it('prefers UNSUBSCRIBE_SECRET', () => {
    expect(getLinkSigningSecret({ UNSUBSCRIBE_SECRET: 'links', SESSION_SECRET: STRONG })).toBe('links');
  });

  it('falls back to SESSION_SECRET', () => {
    expect(getLinkSigningSecret({ SESSION_SECRET: STRONG })).toBe(STRONG);
  });

  it('has no hard-coded fallback in production', () => {
    expect(() => getLinkSigningSecret({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
  });
});
