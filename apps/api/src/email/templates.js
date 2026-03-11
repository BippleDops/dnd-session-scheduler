/**
 * Email template builders.
 * Ported directly from EmailTemplates.gs — no GAS dependencies.
 */

function formatDateForEmail(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
  } catch (e) {}
  return String(dateStr);
}

function formatTimeForEmail(timeStr) {
  if (!timeStr) return '';
  try {
    const parts = String(timeStr).split(':');
    let hours = parseInt(parts[0], 10);
    const mins = parts[1] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return displayHour + ':' + mins + ' ' + ampm + ' CT';
  } catch (e) {}
  return String(timeStr);
}

/**
 * @param {string} title
 * @param {string} content
 * @param {string} [unsubscribeUrl] — one-click unsubscribe link
 */
function wrapEmailTemplate(title, content, unsubscribeUrl) {
  const unsubLine = unsubscribeUrl
    ? `<p style="margin-top:8px;"><a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline;">Unsubscribe from this type of email</a></p>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f5f0e1;color:#2c2c2c;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
<div style="background:#8b0000;padding:20px 30px;"><h1 style="margin:0;color:#fff;font-size:20px;">D&D Session Scheduler</h1></div>
<div style="padding:30px;">${content}</div>
<div style="background:#f5f0e1;padding:15px 30px;font-size:12px;color:#888;text-align:center;">
This is an automated message from the D&D Session Scheduler.${unsubLine}
<p style="margin-top:4px;"><a href="${process.env.BASE_URL || ''}/profile" style="color:#999;">Manage email preferences</a></p>
</div></div></body></html>`;
}

function buildConfirmationEmail(session, character, playerName) {
  const content = `<h2 style="color:#8b0000;">Registration Confirmed!</h2>
<p>Hey ${playerName},</p>
<p>You're all set! <strong>${character.name}</strong> has been registered for:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9f6ef;border-radius:8px;">
<tr><td style="padding:10px;font-weight:bold;width:120px;">Date</td><td style="padding:10px;">${formatDateForEmail(session.date)}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Time</td><td style="padding:10px;">${formatTimeForEmail(session.startTime)} — ${formatTimeForEmail(session.endTime)}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Campaign</td><td style="padding:10px;">${session.campaign}</td></tr>
${session.title ? `<tr><td style="padding:10px;font-weight:bold;">Session</td><td style="padding:10px;">${session.title}</td></tr>` : ''}
</table>
<p>You'll receive a reminder 2 days before the session. See you at the table!</p>`;
  return wrapEmailTemplate('Registration Confirmed', content);
}

function buildPlayerReminderEmail(session, roster, charName) {
  const rosterHtml = roster.map(r =>
    `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${r.characterName}</td>
     <td style="padding:8px;border-bottom:1px solid #ddd;">${r.characterClass}</td>
     <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${r.characterLevel}</td></tr>`
  ).join('');
  const content = `<h2 style="color:#8b0000;">Your Adventure Awaits!</h2>
<p>Hail, <strong>${charName}</strong>! Reminder for your upcoming session:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
<tr><td style="padding:8px;font-weight:bold;width:120px;">Date</td><td style="padding:8px;">${formatDateForEmail(session.date)}</td></tr>
<tr><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${formatTimeForEmail(session.startTime)} — ${formatTimeForEmail(session.endTime)}</td></tr>
<tr><td style="padding:8px;font-weight:bold;">Campaign</td><td style="padding:8px;">${session.campaign}</td></tr>
</table>
<h3 style="color:#8b0000;">Your Fellow Adventurers</h3>
<table style="width:100%;border-collapse:collapse;margin:10px 0;">
<tr style="background:#f5f0e1;"><th style="padding:8px;text-align:left;">Character</th><th style="padding:8px;text-align:left;">Class</th><th style="padding:8px;text-align:center;">Level</th></tr>
${rosterHtml}</table>
<p style="margin-top:20px;">See you at the table! May your rolls be ever in your favor.</p>`;
  return wrapEmailTemplate('Session Reminder', content);
}

function buildDMInfoSheetEmail(session, players) {
  const playerRows = players.map(p => {
    let row = `<tr>
<td style="padding:8px;border-bottom:1px solid #ddd;">${p.playerName || ''}</td>
<td style="padding:8px;border-bottom:1px solid #ddd;">${p.playerEmail || ''}</td>
<td style="padding:8px;border-bottom:1px solid #ddd;">${p.characterName || ''}</td>
<td style="padding:8px;border-bottom:1px solid #ddd;">${p.characterClass || ''}</td>
<td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${p.characterLevel || ''}</td>
</tr>`;
    const notes = [];
    if (p.accessibilityNeeds) notes.push(`<strong>Accessibility:</strong> ${p.accessibilityNeeds}`);
    if (p.dmNotes) notes.push(`<strong>DM Notes:</strong> ${p.dmNotes}`);
    if (notes.length > 0) {
      row += `<tr><td colspan="5" style="padding:4px 8px 12px;font-size:13px;color:#666;border-bottom:2px solid #ccc;">${notes.join(' | ')}</td></tr>`;
    }
    return row;
  }).join('');

  const content = `<h2 style="color:#8b0000;">Session Info Sheet</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9f6ef;">
<tr><td style="padding:10px;font-weight:bold;width:120px;">Date</td><td style="padding:10px;">${formatDateForEmail(session.date)}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Time</td><td style="padding:10px;">${formatTimeForEmail(session.startTime)} — ${formatTimeForEmail(session.endTime)}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Campaign</td><td style="padding:10px;">${session.campaign}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Players</td><td style="padding:10px;">${players.length} registered</td></tr>
</table>
<h3 style="color:#8b0000;">Player Details</h3>
<table style="width:100%;border-collapse:collapse;margin:10px 0;">
<tr style="background:#f5f0e1;"><th style="padding:8px;text-align:left;">Name</th><th style="padding:8px;text-align:left;">Email</th>
<th style="padding:8px;text-align:left;">Character</th><th style="padding:8px;text-align:left;">Class</th>
<th style="padding:8px;text-align:center;">Level</th></tr>
${playerRows}</table>
${session.dmNotes ? `<h3 style="color:#8b0000;">Your DM Notes</h3><p style="background:#fffbe6;padding:12px;border-radius:6px;">${session.dmNotes}</p>` : ''}`;
  return wrapEmailTemplate('Session Info Sheet', content);
}

function buildCancellationEmail(session, playerName, characterName) {
  const content = `<h2 style="color:#8b0000;">Session Cancelled</h2>
<p>Hey ${playerName},</p>
<p>Unfortunately, the following session has been cancelled:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fff3f3;border-radius:8px;">
<tr><td style="padding:10px;font-weight:bold;width:120px;">Date</td><td style="padding:10px;"><s>${formatDateForEmail(session.date)}</s></td></tr>
<tr><td style="padding:10px;font-weight:bold;">Campaign</td><td style="padding:10px;">${session.campaign}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Character</td><td style="padding:10px;">${characterName}</td></tr>
</table>
<p>Please check the session calendar for other upcoming sessions!</p>`;
  return wrapEmailTemplate('Session Cancelled', content);
}

function buildWaitlistPromotionEmail(session, playerName, characterName) {
  const content = `<h2 style="color:#8b0000;">You're In! 🎉</h2>
<p>Hey ${playerName},</p>
<p>A spot just opened up! <strong>${characterName}</strong> has been promoted from the waitlist and is now confirmed for:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f0f9e8;border-radius:8px;">
<tr><td style="padding:10px;font-weight:bold;width:120px;">Date</td><td style="padding:10px;">${formatDateForEmail(session.date)}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Time</td><td style="padding:10px;">${formatTimeForEmail(session.startTime)} — ${formatTimeForEmail(session.endTime)}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Campaign</td><td style="padding:10px;">${session.campaign}</td></tr>
${session.title ? `<tr><td style="padding:10px;font-weight:bold;">Session</td><td style="padding:10px;">${session.title}</td></tr>` : ''}
</table>
<p>Make sure your character sheet is up to date. See you at the table!</p>`;
  return wrapEmailTemplate('Waitlist Promotion', content);
}

function buildNoShowEmail(session, playerName) {
  const content = `<h2 style="color:#8b0000;">We Missed You! 😔</h2>
<p>Hey ${playerName},</p>
<p>We noticed you weren't able to make it to the session:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9f6ef;border-radius:8px;">
<tr><td style="padding:10px;font-weight:bold;width:120px;">Date</td><td style="padding:10px;">${formatDateForEmail(session.date)}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Campaign</td><td style="padding:10px;">${session.campaign}</td></tr>
</table>
<p>Everything okay? If something came up, no worries at all — we just wanted to check in.</p>
<p>Here are some upcoming sessions you might want to join:</p>
<p style="margin-top:16px;"><a href="${process.env.BASE_URL || ''}/sessions" style="display:inline-block;padding:10px 24px;background:#8b0000;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Browse Upcoming Sessions</a></p>`;
  return wrapEmailTemplate('We Missed You', content);
}

function buildAchievementEmail(playerName, achievement) {
  const content = `<h2 style="color:#8b0000;">🏆 Achievement Unlocked!</h2>
<p>Congratulations, ${playerName}!</p>
<div style="text-align:center;margin:24px 0;padding:20px;background:#fffbe6;border-radius:8px;border:2px solid #c9a959;">
<span style="font-size:48px;display:block;margin-bottom:8px;">${achievement.icon}</span>
<h3 style="margin:0;color:#8b0000;font-size:20px;">${achievement.name}</h3>
<p style="margin:4px 0 0;color:#666;">${achievement.description}</p>
</div>
<p>Keep adventuring — more achievements await!</p>
<p style="margin-top:16px;"><a href="${process.env.BASE_URL || ''}/stats" style="display:inline-block;padding:10px 24px;background:#8b0000;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">View All Achievements</a></p>`;
  return wrapEmailTemplate('Achievement Unlocked', content);
}

function buildInactivityEmail(playerName, upcomingSessions) {
  let sessionsList = '';
  if (upcomingSessions.length > 0) {
    sessionsList = `<h3 style="color:#8b0000;">Upcoming Adventures</h3><ul style="margin:10px 0;">`;
    for (const s of upcomingSessions) {
      sessionsList += `<li style="margin:6px 0;"><strong>${s.title || s.campaign}</strong> — ${formatDateForEmail(s.date)} (${s.spotsRemaining > 0 ? s.spotsRemaining + ' spots' : 'FULL'})</li>`;
    }
    sessionsList += `</ul>`;
  }
  const content = `<h2 style="color:#8b0000;">We Miss You, Adventurer! 🗡️</h2>
<p>Hey ${playerName},</p>
<p>It's been a while since your last adventure. The party isn't the same without you!</p>
${sessionsList || '<p>Check the quest board for new sessions.</p>'}
<p style="margin-top:16px;"><a href="${process.env.BASE_URL || ''}" style="display:inline-block;padding:10px 24px;background:#8b0000;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Return to the Quest Board</a></p>`;
  return wrapEmailTemplate('We Miss You', content);
}

function buildWeeklyDigestEmail(playerName, upcomingSessions, recentRecaps, achievementsEarned) {
  let sessionsList = '';
  if (upcomingSessions.length > 0) {
    sessionsList = `<h3 style="color:#8b0000;">📅 This Week's Sessions</h3><ul style="margin:10px 0;">`;
    for (const s of upcomingSessions) {
      sessionsList += `<li style="margin:6px 0;"><strong>${s.title || s.campaign}</strong> — ${formatDateForEmail(s.date)} at ${formatTimeForEmail(s.startTime)} (${s.spotsRemaining > 0 ? s.spotsRemaining + ' spots open' : 'FULL'})</li>`;
    }
    sessionsList += `</ul>`;
  }
  let recapsList = '';
  if (recentRecaps.length > 0) {
    recapsList = `<h3 style="color:#8b0000;">📖 Recent Recaps</h3><ul style="margin:10px 0;">`;
    for (const r of recentRecaps) {
      recapsList += `<li style="margin:6px 0;"><strong>${r.campaign}</strong> — ${formatDateForEmail(r.date)}: ${(r.recap || '').slice(0, 120)}${r.recap?.length > 120 ? '...' : ''}</li>`;
    }
    recapsList += `</ul>`;
  }
  let achievementsList = '';
  if (achievementsEarned.length > 0) {
    achievementsList = `<h3 style="color:#8b0000;">🏆 Achievements This Week</h3><ul style="margin:10px 0;">`;
    for (const a of achievementsEarned) { achievementsList += `<li style="margin:6px 0;">${a.icon} <strong>${a.name}</strong> — ${a.description}</li>`; }
    achievementsList += `</ul>`;
  }
  const content = `<h2 style="color:#8b0000;">⚔️ This Week in D&D</h2>
<p>Hail, ${playerName}! Here's your weekly adventurer's briefing:</p>
${sessionsList || '<p style="color:#666;"><em>No sessions scheduled this week.</em></p>'}
${recapsList}${achievementsList}
<p style="margin-top:20px;"><a href="${process.env.BASE_URL || ''}" style="display:inline-block;padding:10px 24px;background:#8b0000;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Visit the Quest Board</a></p>`;
  return wrapEmailTemplate('Weekly Digest', content);
}

function buildRsvpEmail(session, playerName, characterName, yesUrl, noUrl) {
  const content = `<h2 style="color:#8b0000;">Are You Still Coming? 🎲</h2>
<p>Hey ${playerName},</p>
<p>Your session is coming up soon! Please confirm your attendance for <strong>${characterName}</strong>:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9f6ef;border-radius:8px;">
<tr><td style="padding:10px;font-weight:bold;width:120px;">Date</td><td style="padding:10px;">${formatDateForEmail(session.date)}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Time</td><td style="padding:10px;">${formatTimeForEmail(session.startTime)} — ${formatTimeForEmail(session.endTime)}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Campaign</td><td style="padding:10px;">${session.campaign}</td></tr>
</table>
<div style="text-align:center;margin:24px 0;">
<a href="${yesUrl}" style="display:inline-block;padding:12px 32px;background:#006600;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;margin:0 8px;">✅ Yes, I'm Coming!</a>
<a href="${noUrl}" style="display:inline-block;padding:12px 32px;background:#8b0000;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;margin:0 8px;">❌ Can't Make It</a>
</div>
<p style="font-size:13px;color:#666;">If we don't hear from you, we'll assume you're coming. See you there!</p>`;
  return wrapEmailTemplate('RSVP Confirmation', content);
}

function buildSessionUpdateEmail(session, changes, playerName) {
  const changeRows = changes.map(c =>
    `<tr><td style="padding:8px;font-weight:bold;width:120px;">${c.field}</td><td style="padding:8px;text-decoration:line-through;color:#999;">${c.oldValue}</td><td style="padding:8px;color:#006600;font-weight:bold;">${c.newValue}</td></tr>`
  ).join('');
  const content = `<h2 style="color:#8b0000;">Session Updated</h2>
<p>Hey ${playerName},</p>
<p>The following session you're registered for has been updated:</p>
<p style="font-weight:bold;font-size:16px;">${session.title || session.campaign} — ${formatDateForEmail(session.date)}</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fffbe6;border-radius:8px;">
<tr style="background:#f5f0e1;"><th style="padding:8px;text-align:left;">Field</th><th style="padding:8px;text-align:left;">Was</th><th style="padding:8px;text-align:left;">Now</th></tr>
${changeRows}
</table>
<p>Please update your calendar accordingly. See you there!</p>`;
  return wrapEmailTemplate('Session Updated', content);
}

function getEmailSubject(type, session) {
  const campaign = session.campaign || '';
  const date = session.date || '';
  const prefix = 'D&D Session';
  switch (type) {
    case 'reminder': return `${prefix} Reminder — ${campaign} — ${date}`;
    case 'confirmation': return `${prefix} Confirmed — ${campaign} — ${date}`;
    case 'cancellation': return `${prefix} Cancelled — ${campaign} — ${date}`;
    case 'dm-info': return `[DM] Session Info Sheet — ${campaign} — ${date}`;
    case 'dm-recap': return `[DM] Recap Reminder — ${campaign} — ${date}`;
    case 'waitlist-promotion': return `${prefix} — You're In! — ${campaign} — ${date}`;
    case 'update': return `${prefix} Updated — ${campaign} — ${date}`;
    case 'rsvp': return `${prefix} — Are you coming? — ${campaign} — ${date}`;
    default: return `${prefix} — ${campaign}`;
  }
}

module.exports = {
  wrapEmailTemplate,
  buildConfirmationEmail,
  buildPlayerReminderEmail,
  buildDMInfoSheetEmail,
  buildCancellationEmail,
  buildWaitlistPromotionEmail,
  buildSessionUpdateEmail,
  buildNoShowEmail,
  buildAchievementEmail,
  buildInactivityEmail,
  buildWeeklyDigestEmail,
  buildRsvpEmail,
  getEmailSubject,
  formatDateForEmail,
  formatTimeForEmail,
};

