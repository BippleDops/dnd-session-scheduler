/**
 * Campaign hub management service.
 */
const { getDb, generateUuid, logAction } = require('../db');

function getAllCampaigns() {
  return getDb().prepare('SELECT * FROM campaigns ORDER BY name').all();
}

function getCampaignBySlug(slug) {
  return getDb().prepare('SELECT * FROM campaigns WHERE slug = ?').get(slug);
}

function getCampaignById(campaignId) {
  return getDb().prepare('SELECT * FROM campaigns WHERE campaign_id = ?').get(campaignId);
}

function updateCampaign(campaignId, data) {
  const db = getDb();
  const fields = ['name','description','lore','house_rules','banner_url','world_map_url','default_tier'];
  const updates = {};
  for (const f of fields) {
    const camel = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (data[camel] !== undefined) updates[f] = data[camel];
  }
  if (Object.keys(updates).length === 0) return { success: false, error: 'Nothing to update' };
  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE campaigns SET ${set} WHERE campaign_id = ?`).run(...Object.values(updates), campaignId);
  logAction('CAMPAIGN_UPDATED', `Campaign ${campaignId} updated`, '', campaignId);
  return { success: true };
}

function getCampaignSessions(campaignName) {
  return getDb().prepare(`SELECT * FROM sessions WHERE campaign = ? ORDER BY date DESC`).all(campaignName);
}

function getCampaignRoster(campaignName) {
  return getDb().prepare(`
    SELECT p.player_id, p.name, p.photo_url,
      COUNT(DISTINCT r.session_id) as session_count,
      GROUP_CONCAT(DISTINCT r.char_name_snapshot) as characters
    FROM registrations r
    JOIN sessions s ON r.session_id = s.session_id
    JOIN players p ON r.player_id = p.player_id
    WHERE s.campaign = ? AND r.status IN ('Confirmed','Attended')
    GROUP BY p.player_id
    ORDER BY session_count DESC
  `).all(campaignName);
}

function getCampaignTimeline(campaignName) {
  return getDb().prepare(`
    SELECT s.session_id, s.date, s.title, s.status,
      h.dm_post_notes,
      COUNT(r.registration_id) as player_count,
      GROUP_CONCAT(r.char_name_snapshot, ', ') as characters
    FROM sessions s
    LEFT JOIN session_history h ON s.session_id = h.session_id
    LEFT JOIN registrations r ON s.session_id = r.session_id AND r.status IN ('Confirmed','Attended')
    WHERE s.campaign = ?
    GROUP BY s.session_id
    ORDER BY s.date DESC
  `).all(campaignName);
}

module.exports = { getAllCampaigns, getCampaignBySlug, getCampaignById, updateCampaign, getCampaignSessions, getCampaignRoster, getCampaignTimeline };

