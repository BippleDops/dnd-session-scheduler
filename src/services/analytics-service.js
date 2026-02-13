/**
 * Analytics and engagement scoring service.
 */
const { getDb, generateUuid, nowTimestamp } = require('../db');

/**
 * Calculate engagement score for a player.
 * Combines: attendance rate, journal writing, downtime submissions, discussion activity.
 */
function calculateEngagementScore(playerId) {
  const db = getDb();

  // Attendance (0-40 points)
  const totalReg = db.prepare("SELECT COUNT(*) as c FROM registrations WHERE player_id = ? AND status IN ('Confirmed','Attended','No-Show')").get(playerId);
  const attended = db.prepare("SELECT COUNT(*) as c FROM registrations WHERE player_id = ? AND status = 'Attended'").get(playerId);
  const attendanceRate = totalReg.c > 0 ? attended.c / totalReg.c : 0;
  const attendanceScore = Math.round(attendanceRate * 40);

  // Journals (0-20 points, 4 pts each up to 5)
  const journalCount = db.prepare('SELECT COUNT(*) as c FROM character_journals WHERE player_id = ?').get(playerId);
  const journalScore = Math.min(20, journalCount.c * 4);

  // Downtime (0-20 points, 5 pts each up to 4)
  const downtimeCount = db.prepare('SELECT COUNT(*) as c FROM downtime_actions WHERE player_id = ?').get(playerId);
  const downtimeScore = Math.min(20, downtimeCount.c * 5);

  // Discussion activity (0-20 points, 2 pts per post up to 10)
  const postCount = db.prepare('SELECT COUNT(*) as c FROM discussion_posts WHERE player_id = ?').get(playerId);
  const discussionScore = Math.min(20, postCount.c * 2);

  const overallScore = attendanceScore + journalScore + downtimeScore + discussionScore;

  // Upsert score
  db.prepare(`INSERT INTO engagement_scores (player_id, attendance_score, journal_score, downtime_score, discussion_score, overall_score, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(player_id) DO UPDATE SET attendance_score=?, journal_score=?, downtime_score=?, discussion_score=?, overall_score=?, updated_at=datetime('now')`)
    .run(playerId, attendanceScore, journalScore, downtimeScore, discussionScore, overallScore,
      attendanceScore, journalScore, downtimeScore, discussionScore, overallScore);

  return { attendanceScore, journalScore, downtimeScore, discussionScore, overallScore };
}

/**
 * Refresh all player engagement scores.
 */
function refreshAllEngagementScores() {
  const db = getDb();
  const players = db.prepare("SELECT player_id FROM players WHERE active_status = 'Active'").all();
  let updated = 0;
  for (const p of players) {
    calculateEngagementScore(p.player_id);
    updated++;
  }
  return { updated };
}

/**
 * Get DM insights — smart suggestions based on data patterns.
 */
function getDMInsights() {
  const db = getDb();
  const insights = [];

  // Inactive players (no registration in 21+ days)
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 21);
  const inactive = db.prepare(`
    SELECT p.name, MAX(s.date) as last_session FROM players p
    LEFT JOIN registrations r ON p.player_id = r.player_id AND r.status IN ('Confirmed','Attended')
    LEFT JOIN sessions s ON r.session_id = s.session_id
    WHERE p.active_status = 'Active'
    GROUP BY p.player_id HAVING last_session < ? OR last_session IS NULL
  `).all(cutoff.toISOString().slice(0, 10));
  for (const p of inactive) {
    insights.push({ type: 'inactive_player', icon: '😴', message: `${p.name} hasn't played in 3+ weeks`, priority: 'medium' });
  }

  // Campaign with highest no-show rate
  const noShowStats = db.prepare(`
    SELECT s.campaign, COUNT(CASE WHEN r.status = 'No-Show' THEN 1 END) as noShows,
      COUNT(*) as total FROM registrations r JOIN sessions s ON r.session_id = s.session_id
    WHERE r.status IN ('Attended','No-Show') GROUP BY s.campaign HAVING total >= 3
  `).all();
  for (const c of noShowStats) {
    const rate = Math.round((c.noShows / c.total) * 100);
    if (rate > 20) insights.push({ type: 'high_noshow', icon: '⚠️', message: `${c.campaign} has a ${rate}% no-show rate`, priority: 'high' });
  }

  // Day of week analysis
  const dayStats = db.prepare(`
    SELECT strftime('%w', date) as dow, COUNT(*) as count,
      AVG((SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.session_id AND r.status IN ('Confirmed','Attended'))) as avg_players
    FROM sessions s WHERE status IN ('Completed','Scheduled') GROUP BY dow ORDER BY avg_players DESC
  `).all();
  if (dayStats.length >= 2) {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const best = dayStats[0];
    insights.push({ type: 'best_day', icon: '📅', message: `${days[parseInt(best.dow)]}s have the best attendance (avg ${Math.round(best.avg_players)} players)`, priority: 'low' });
  }

  // Tier recommendations
  const tierCounts = db.prepare(`
    SELECT CASE WHEN c.level BETWEEN 1 AND 4 THEN 'tier1' WHEN c.level BETWEEN 5 AND 10 THEN 'tier2'
      WHEN c.level BETWEEN 11 AND 16 THEN 'tier3' ELSE 'tier4' END as tier, COUNT(*) as count
    FROM characters c WHERE c.status = 'Active' GROUP BY tier ORDER BY count DESC
  `).all();
  if (tierCounts.length > 0) {
    const top = tierCounts[0];
    const tierNames = { tier1: 'Tier 1 (Lv 1-4)', tier2: 'Tier 2 (Lv 5-10)', tier3: 'Tier 3 (Lv 11-16)', tier4: 'Tier 4 (Lv 17-20)' };
    insights.push({ type: 'tier_recommendation', icon: '🎯', message: `Most active characters are ${tierNames[top.tier] || top.tier} — consider scheduling sessions for this tier`, priority: 'low' });
  }

  return insights.sort((a, b) => { const p = { high: 0, medium: 1, low: 2 }; return (p[a.priority] || 2) - (p[b.priority] || 2); });
}

/**
 * Generate "Previously On..." from last session's recap + moments.
 */
function generatePreviouslyOn(campaignName) {
  const db = getDb();
  const lastSession = db.prepare(`
    SELECT h.dm_post_notes, h.session_date, h.attendee_char_names
    FROM session_history h WHERE h.campaign = ? AND h.dm_post_notes IS NOT NULL AND h.dm_post_notes != ''
    ORDER BY h.session_date DESC LIMIT 1
  `).get(campaignName);
  if (!lastSession) return null;

  const recap = lastSession.dm_post_notes;
  // Take first 500 chars as a summary
  const summary = recap.length > 500 ? recap.slice(0, 500) + '...' : recap;
  return { date: lastSession.session_date, characters: lastSession.attendee_char_names, summary };
}

/**
 * NPC generator using random tables.
 */
function generateRandomNPC(role) {
  const firstNames = ['Aldric','Brynn','Cael','Dara','Eldrin','Fiona','Gareth','Helga','Irena','Jasper','Kira','Ludo','Miriel','Niko','Orin','Petra','Quinn','Rael','Siri','Thorn','Ulric','Vex','Wren','Xara','Yara','Zeph'];
  const lastNames = ['Ashford','Blackwood','Copperfield','Darkhollow','Emberheart','Frostweaver','Goldleaf','Hawkwind','Ironforge','Jadeclaw','Knightshield','Loamfoot','Moonwhisper','Nightshade','Oakenshield','Pinecrest','Quicksilver','Ravencrest','Silverstream','Thornwall','Underbough','Voidwalker','Windrider','Yellowstone','Zenith'];
  const personalities = ['Boisterous and loud','Quiet and observant','Nervous and fidgety','Confident and charming','Grumpy but kind-hearted','Mysterious and evasive','Jolly and generous','Stern and disciplined','Absent-minded scholar','Paranoid conspiracy theorist'];
  const quirks = ['Always carries a pet mouse','Speaks in rhyming couplets when nervous','Collects unusual buttons','Has a dramatic scar they never explain','Laughs at inappropriate moments','Constantly whittling wood figurines','Refers to self in third person','Has an extremely refined palate','Allergic to magic','Tells obviously false war stories'];
  const voiceNotes = ['Deep gravelly voice','High-pitched and excitable','Speaks very slowly and deliberately','Strong regional accent','Whispers everything','Clears throat constantly','Overly formal diction','Slang-heavy casual speech'];

  const roleDesc = {
    merchant: 'Runs a shop or trading post', villain: 'Antagonist with dark motives', guide: 'Knows the local area well',
    quest_giver: 'Has a problem that needs solving', ally: 'Willing to help the party', neutral: 'Has their own agenda',
  };

  const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  return {
    name,
    role: role || 'neutral',
    roleDescription: roleDesc[role] || 'A mysterious figure',
    personality: personalities[Math.floor(Math.random() * personalities.length)],
    quirk: quirks[Math.floor(Math.random() * quirks.length)],
    voiceNote: voiceNotes[Math.floor(Math.random() * voiceNotes.length)],
  };
}

module.exports = { calculateEngagementScore, refreshAllEngagementScores, getDMInsights, generatePreviouslyOn, generateRandomNPC };
