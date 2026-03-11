/**
 * Tests for campaign-service.js
 */
const { setupDbMock, closeTestDb, insertTestPlayer, insertTestSession, insertTestRegistration } = require('../helpers/setup-db');
const crypto = require('crypto');

let db;

beforeEach(() => {
  jest.resetModules();
  db = setupDbMock();
});

afterEach(() => {
  closeTestDb();
  jest.restoreAllMocks();
});

function insertTestCampaign(db, overrides = {}) {
  const id = overrides.campaign_id || crypto.randomUUID();
  db.prepare(`INSERT INTO campaigns (campaign_id, slug, name, description, lore) VALUES (?, ?, ?, ?, ?)`)
    .run(id, overrides.slug || 'test-campaign', overrides.name || 'Test Campaign', overrides.description || '', overrides.lore || '');
  return { campaign_id: id, slug: overrides.slug || 'test-campaign', name: overrides.name || 'Test Campaign' };
}

describe('getAllCampaigns', () => {
  it('returns all campaigns', () => {
    const { getAllCampaigns } = require('../../src/services/campaign-service');
    insertTestCampaign(db, { name: 'Alpha', slug: 'alpha' });
    insertTestCampaign(db, { name: 'Beta', slug: 'beta' });

    const campaigns = getAllCampaigns();
    expect(campaigns.length).toBe(2);
  });
});

describe('getCampaignBySlug', () => {
  it('finds campaign by slug', () => {
    const { getCampaignBySlug } = require('../../src/services/campaign-service');
    insertTestCampaign(db, { slug: 'aethermoor', name: 'Aethermoor' });

    const campaign = getCampaignBySlug('aethermoor');
    expect(campaign).toBeTruthy();
    expect(campaign.name).toBe('Aethermoor');
  });

  it('returns undefined for unknown slug', () => {
    const { getCampaignBySlug } = require('../../src/services/campaign-service');
    expect(getCampaignBySlug('nonexistent')).toBeUndefined();
  });
});

describe('getCampaignById', () => {
  it('finds campaign by ID', () => {
    const { getCampaignById } = require('../../src/services/campaign-service');
    const campaign = insertTestCampaign(db);

    const result = getCampaignById(campaign.campaign_id);
    expect(result).toBeTruthy();
    expect(result.name).toBe('Test Campaign');
  });
});

describe('updateCampaign', () => {
  it('updates campaign fields', () => {
    const { updateCampaign, getCampaignById } = require('../../src/services/campaign-service');
    const campaign = insertTestCampaign(db);

    const result = updateCampaign(campaign.campaign_id, {
      name: 'Updated Name',
      description: 'New description',
      lore: 'Ancient lore...',
    });

    expect(result.success).toBe(true);
    const updated = getCampaignById(campaign.campaign_id);
    expect(updated.name).toBe('Updated Name');
    expect(updated.description).toBe('New description');
    expect(updated.lore).toBe('Ancient lore...');
  });

  it('returns error when nothing to update', () => {
    const { updateCampaign } = require('../../src/services/campaign-service');
    const campaign = insertTestCampaign(db);

    const result = updateCampaign(campaign.campaign_id, { unknownField: 'value' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Nothing to update');
  });
});

describe('getCampaignSessions', () => {
  it('returns sessions for a campaign', () => {
    const { getCampaignSessions } = require('../../src/services/campaign-service');
    insertTestSession(db, { campaign: 'Aethermoor' });
    insertTestSession(db, { campaign: 'Aethermoor' });
    insertTestSession(db, { campaign: 'Terravor' });

    const sessions = getCampaignSessions('Aethermoor');
    expect(sessions.length).toBe(2);
  });
});

describe('getCampaignRoster', () => {
  it('returns distinct players with session counts', () => {
    const { getCampaignRoster } = require('../../src/services/campaign-service');
    const s1 = insertTestSession(db, { campaign: 'Aethermoor' });
    const s2 = insertTestSession(db, { campaign: 'Aethermoor' });
    const player = insertTestPlayer(db);
    insertTestRegistration(db, s1.session_id, player.player_id);
    insertTestRegistration(db, s2.session_id, player.player_id);

    const roster = getCampaignRoster('Aethermoor');
    expect(roster.length).toBe(1);
    expect(roster[0].session_count).toBe(2);
  });
});

describe('getCampaignTimeline', () => {
  it('returns sessions with player counts', () => {
    const { getCampaignTimeline } = require('../../src/services/campaign-service');
    const session = insertTestSession(db, { campaign: 'Aethermoor' });
    const player = insertTestPlayer(db);
    insertTestRegistration(db, session.session_id, player.player_id);

    const timeline = getCampaignTimeline('Aethermoor');
    expect(timeline.length).toBe(1);
    expect(timeline[0].player_count).toBe(1);
  });
});
