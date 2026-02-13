// API client — all fetch calls to Express backend

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${url}`, {
      credentials: 'include',
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
    });
  } catch {
    throw new Error('Network error — please check your connection.');
  }

  if (res.status === 401) throw new Error('Not authenticated');
  if (res.status === 429) throw new Error('Too many requests — please slow down.');

  // Try to parse JSON; fall back to text error message
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    throw new Error('Unexpected response format');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  }
  return data;
}

// ── Public ──
export const getSessions = () => fetchJson<Session[]>('/api/sessions');
export const getSession = (id: string) => fetchJson<SessionDetail>(`/api/sessions/${id}`);
export const getCampaigns = () => fetchJson<string[]>('/api/campaigns');
export const getRecaps = (campaign?: string) => fetchJson<Recap[]>(`/api/recaps${campaign ? `?campaign=${campaign}` : ''}`);
export const getCsrfToken = () => fetchJson<{ token: string }>('/api/csrf-token');
export const submitSignup = (data: Record<string, unknown>) => fetchJson<ApiResult>('/api/signup', { method: 'POST', body: JSON.stringify(data) });

// ── Auth ──
export const getMyRole = () => fetchJson<UserRole>('/api/me/role');
export const getMyProfile = () => fetchJson<PlayerProfile | null>('/api/me/profile');
export const updateMyProfile = (data: Record<string, unknown>) => fetchJson<ApiResult>('/api/me/profile', { method: 'PUT', body: JSON.stringify(data) });
export const getMyRegistrations = () => fetchJson<MyRegistrations>('/api/me/registrations');
export const cancelMyRegistration = (id: string) => fetchJson<ApiResult>(`/api/me/registrations/${id}`, { method: 'DELETE' });
export const getMyCharacters = () => fetchJson<Character[]>('/api/me/characters');
export const getMyFeedToken = () => fetchJson<{ token: string; url: string }>('/api/me/feed-token');
export const getMyEmailPreferences = () => fetchJson<EmailPreferences>('/api/me/email-preferences');
export const updateMyEmailPreferences = (prefs: Partial<EmailPreferences>) => fetchJson<ApiResult>('/api/me/email-preferences', { method: 'PUT', body: JSON.stringify(prefs) });
export const getMyContacts = () => fetchJson<{ id: string; name: string }[]>('/api/me/contacts');
export const getMyNotifications = () => fetchJson<{ notifications: Notification[]; unread: number }>('/api/me/notifications');
export const markAllNotificationsRead = () => fetchJson<ApiResult>('/api/me/notifications/read-all', { method: 'POST' });
export const cancelByToken = (token: string) => fetchJson<ApiResult>('/api/cancel-by-token', { method: 'POST', body: JSON.stringify({ token }) });
export const getSessionComments = (id: string) => fetchJson<Comment[]>(`/api/sessions/${id}/comments`);
export const postSessionComment = (id: string, text: string) => fetchJson<ApiResult>(`/api/sessions/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) });

// ── Characters V2 ──
export const getMyCharactersV2 = () => fetchJson<CharacterSheet[]>('/api/me/characters-v2');
export const getCharacterDetail = (id: string) => fetchJson<CharacterSheet>(`/api/characters/${id}`);
export const getCharacterSessions = (id: string) => fetchJson<CharacterSessionEntry[]>(`/api/characters/${id}/sessions`);
export const getCharacterLoot = (id: string) => fetchJson<LootEntry[]>(`/api/characters/${id}/loot`);
export const createMyCharacter = (data: Record<string, unknown>) => fetchJson<ApiResult & { characterId?: string }>('/api/me/characters', { method: 'POST', body: JSON.stringify(data) });
export const updateMyCharacter = (id: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/me/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const retireMyCharacter = (id: string) => fetchJson<ApiResult>(`/api/me/characters/${id}`, { method: 'DELETE' });

// ── Campaigns V2 ──
export const getCampaignsList = () => fetchJson<Campaign[]>('/api/campaigns-list');
export const getCampaignDetail = (slug: string) => fetchJson<Campaign>(`/api/campaigns/${slug}`);
export const getCampaignRoster = (slug: string) => fetchJson<CampaignRosterEntry[]>(`/api/campaigns/${slug}/roster`);
export const getCampaignTimeline = (slug: string) => fetchJson<CampaignTimelineEntry[]>(`/api/campaigns/${slug}/timeline`);
export const updateAdminCampaign = (id: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/admin/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const setCharacterLevel = (id: string, level: number) => fetchJson<ApiResult>(`/api/admin/characters/${id}/level`, { method: 'PUT', body: JSON.stringify({ level }) });

// ── Dice ──
export const rollDice = (expression: string, sessionId?: string) => fetchJson<DiceRollResult>('/api/dice/roll', { method: 'POST', body: JSON.stringify({ expression, sessionId }) });
export const getDiceHistory = (sessionId: string) => fetchJson<DiceRoll[]>(`/api/dice/history/${sessionId}`);

// ── Initiative ──
export const getInitiativeEntries = (sessionId: string) => fetchJson<InitiativeEntry[]>(`/api/initiative/${sessionId}`);
export const addInitiativeEntry = (sessionId: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/initiative/${sessionId}`, { method: 'POST', body: JSON.stringify(data) });
export const updateInitiativeEntry = (entryId: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/initiative/entry/${entryId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteInitiativeEntry = (entryId: string) => fetchJson<ApiResult>(`/api/initiative/entry/${entryId}`, { method: 'DELETE' });
export const clearInitiative = (sessionId: string) => fetchJson<ApiResult>(`/api/initiative/${sessionId}/clear`, { method: 'POST' });

// ── Loot ──
export const addLoot = (data: Record<string, unknown>) => fetchJson<ApiResult>('/api/admin/loot', { method: 'POST', body: JSON.stringify(data) });
export const updateCharacterGold = (characterId: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/admin/characters/${characterId}/gold`, { method: 'PUT', body: JSON.stringify(data) });

// ── Player Recaps ──
export const getPlayerRecaps = (sessionId: string) => fetchJson<PlayerRecap[]>(`/api/sessions/${sessionId}/player-recaps`);
export const submitPlayerRecap = (sessionId: string, content: string) => fetchJson<ApiResult>(`/api/sessions/${sessionId}/player-recaps`, { method: 'POST', body: JSON.stringify({ content }) });

// ── Messages ──
export const getMyMessages = () => fetchJson<Message[]>('/api/me/messages');
export const sendMessage = (data: Record<string, unknown>) => fetchJson<ApiResult>('/api/me/messages', { method: 'POST', body: JSON.stringify(data) });
export const markMessageRead = (id: string) => fetchJson<ApiResult>(`/api/me/messages/${id}/read`, { method: 'POST' });

// ── Achievements ──
export const getMyAchievements = () => fetchJson<Achievement[]>('/api/me/achievements');
export const getPlayerPublicProfile = (id: string) => fetchJson<PlayerPublicProfile>(`/api/players/${id}`);

// ── Analytics ──
export const getAdminAnalytics = () => fetchJson<AnalyticsData>('/api/admin/analytics');
export const getMyStats = () => fetchJson<PlayerStats>('/api/me/stats');

// ── V4: Obsidian Bridge ──
export const getSessionPrep = (id: string) => fetchJson<SessionPrep>(`/api/admin/sessions/${id}/prep`);
export const saveSessionPrep = (id: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/admin/sessions/${id}/prep`, { method: 'PUT', body: JSON.stringify(data) });
export const importSessionNotes = (id: string, markdown: string) => fetchJson<ApiResult>(`/api/admin/sessions/${id}/notes`, { method: 'POST', body: JSON.stringify({ markdown }) });
export const exportSessionNotes = (id: string) => fetchJson<ObsidianExport>(`/api/admin/sessions/${id}/notes`);
export const exportCampaignVault = (slug: string) => fetchJson<CampaignExport>(`/api/admin/obsidian/export/${slug}`);

// ── V4: Pre-Session Autopilot ──
export const getSessionChecklist = (id: string) => fetchJson<SessionChecklist>(`/api/admin/sessions/${id}/checklist`);
export const saveSessionChecklist = (id: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/admin/sessions/${id}/checklist`, { method: 'PUT', body: JSON.stringify(data) });
export const getPolls = () => fetchJson<AvailabilityPoll[]>('/api/polls');
export const getPollDetail = (id: string) => fetchJson<AvailabilityPollDetail>(`/api/polls/${id}`);
export const createPoll = (data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/admin/polls`, { method: 'POST', body: JSON.stringify(data) });
export const votePoll = (id: string, selectedOptions: string[]) => fetchJson<ApiResult>(`/api/polls/${id}/vote`, { method: 'POST', body: JSON.stringify({ selectedOptions }) });

// ── V4: Session Moments ──
export const getSessionMoments = (id: string) => fetchJson<SessionMoment[]>(`/api/sessions/${id}/moments`);
export const addSessionMoment = (id: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/admin/sessions/${id}/moments`, { method: 'POST', body: JSON.stringify(data) });

// ── V4: Character Journals ──
export const getCharacterJournals = (charId: string) => fetchJson<JournalEntry[]>(`/api/characters/${charId}/journals`);
export const addCharacterJournal = (charId: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/me/characters/${charId}/journals`, { method: 'POST', body: JSON.stringify(data) });
export const commentOnJournal = (id: string, comment: string) => fetchJson<ApiResult>(`/api/admin/journals/${id}/comment`, { method: 'PUT', body: JSON.stringify({ comment }) });

// ── V4: Downtime ──
export const getMyDowntime = () => fetchJson<DowntimeAction[]>('/api/me/downtime');
export const submitDowntime = (data: Record<string, unknown>) => fetchJson<ApiResult>('/api/me/downtime', { method: 'POST', body: JSON.stringify(data) });
export const getAdminDowntime = (status?: string) => fetchJson<DowntimeAction[]>(`/api/admin/downtime${status ? `?status=${status}` : ''}`);
export const resolveDowntime = (id: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/admin/downtime/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── V4: Discussions ──
export const getDiscussions = (slug: string) => fetchJson<DiscussionThread[]>(`/api/campaigns/${slug}/discussions`);
export const createThread = (slug: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/campaigns/${slug}/discussions`, { method: 'POST', body: JSON.stringify(data) });
export const getThread = (threadId: string) => fetchJson<DiscussionThreadDetail>(`/api/discussions/${threadId}`);
export const replyToThread = (threadId: string, content: string) => fetchJson<ApiResult>(`/api/discussions/${threadId}/reply`, { method: 'POST', body: JSON.stringify({ content }) });
export const adminThread = (threadId: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/admin/discussions/${threadId}`, { method: 'PUT', body: JSON.stringify(data) });

// ── V4: Questionnaires ──
export const getQuestionnaires = () => fetchJson<Questionnaire[]>('/api/admin/questionnaires');
export const createQuestionnaire = (data: Record<string, unknown>) => fetchJson<ApiResult>('/api/admin/questionnaires', { method: 'POST', body: JSON.stringify(data) });
export const getQuestionnaire = (id: string) => fetchJson<Questionnaire>(`/api/questionnaires/${id}`);
export const respondQuestionnaire = (id: string, answers: Record<string, string>) => fetchJson<ApiResult>(`/api/questionnaires/${id}/respond`, { method: 'POST', body: JSON.stringify({ answers }) });
export const getQuestionnaireResponses = (id: string) => fetchJson<QuestionnaireResponse[]>(`/api/admin/questionnaires/${id}/responses`);

// ── V4: World State ──
export const getWorldState = (slug: string) => fetchJson<WorldStateEntry[]>(`/api/campaigns/${slug}/world-state`);
export const addWorldState = (campaignId: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/admin/campaigns/${campaignId}/world-state`, { method: 'POST', body: JSON.stringify(data) });

// ── V4: Homework ──
export const getMyHomework = () => fetchJson<HomeworkEntry[]>('/api/me/homework');
export const updateHomework = (sessionId: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/me/homework/${sessionId}`, { method: 'PUT', body: JSON.stringify(data) });

// ── V4: Session Requests ──
export const getSessionRequests = () => fetchJson<SessionRequest[]>('/api/session-requests');
export const createSessionRequest = (data: Record<string, unknown>) => fetchJson<ApiResult>('/api/me/session-requests', { method: 'POST', body: JSON.stringify(data) });
export const voteSessionRequest = (id: string, availableDates: string[]) => fetchJson<ApiResult>(`/api/session-requests/${id}/vote`, { method: 'POST', body: JSON.stringify({ availableDates }) });

// ── Admin ──
export const getAdminDashboard = () => fetchJson<AdminDashboard>('/api/admin/dashboard');
export const getAdminHealthDetail = () => fetchJson<HealthDetail>('/api/admin/health-detail');
export const getAdminSessions = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchJson<AdminSession[]>(`/api/admin/sessions${qs}`);
};
export const getAdminSessionDetail = (id: string) => fetchJson<SessionDetail>(`/api/admin/sessions/${id}`);
export const createAdminSession = (data: Record<string, unknown>) => fetchJson<ApiResult>('/api/admin/sessions', { method: 'POST', body: JSON.stringify(data) });
export const updateAdminSession = (id: string, data: Record<string, unknown>) => fetchJson<ApiResult>(`/api/admin/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const cancelAdminSession = (id: string) => fetchJson<ApiResult>(`/api/admin/sessions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ notify: true }) });
export const completeAdminSession = (id: string) => fetchJson<ApiResult>(`/api/admin/sessions/${id}/complete`, { method: 'POST' });
export const markAttendance = (id: string, attended: boolean) => fetchJson<ApiResult>(`/api/admin/registrations/${id}/attendance`, { method: 'POST', body: JSON.stringify({ attended }) });
export const cancelAdminRegistration = (id: string) => fetchJson<ApiResult>(`/api/admin/registrations/${id}/cancel`, { method: 'POST' });
export const getAdminPlayers = (status?: string) => fetchJson<AdminPlayer[]>(`/api/admin/players${status ? `?status=${status}` : ''}`);
export const getAdminPlayerHistory = (id: string) => fetchJson<PlayerHistoryEntry[]>(`/api/admin/players/${id}/history`);
export const setPlayerStatus = (id: string, status: string) => fetchJson<ApiResult>(`/api/admin/players/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
export const getAdminHistory = (params?: Record<string, string>) => fetchJson<HistoryEntry[]>(`/api/admin/history${params ? '?' + new URLSearchParams(params).toString() : ''}`);
export const updateHistoryNotes = (id: string, notes: string) => fetchJson<ApiResult>(`/api/admin/history/${id}/notes`, { method: 'PUT', body: JSON.stringify({ notes }) });
export const getAdminConfig = () => fetchJson<ConfigEntry[]>('/api/admin/config');
export const saveAdminConfig = (key: string, value: string) => fetchJson<ApiResult>(`/api/admin/config/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value }) });
export const getAdminLogs = (page: number, actionType?: string) => fetchJson<LogsResponse>(`/api/admin/logs?page=${page}&perPage=50${actionType ? `&actionType=${actionType}` : ''}`);
export const triggerReminders = () => fetchJson<ApiResult>('/api/admin/trigger-reminders', { method: 'POST' });
export const triggerBackup = () => fetchJson<ApiResult>('/api/admin/trigger-backup', { method: 'POST' });

// ── Types ──
export interface Session {
  sessionId: string; date: string; startTime: string; endTime: string;
  campaign: string; title: string; description: string; maxPlayers: number;
  registeredCount: number; spotsRemaining: number; status: string;
  levelTier?: string; levelTierLabel?: string; location?: string;
  roster: { characterName: string; characterClass: string; characterLevel: number }[];
}
export interface SessionDetail extends Session {
  dmNotes?: string; tags?: string; difficulty?: string;
  registrations?: Registration[];
}
export interface Registration {
  registrationId: string; playerId: string; playerName: string; playerEmail: string;
  characterName: string; characterClass: string; characterLevel: number;
  characterRace?: string; status: string; attendanceConfirmed: boolean;
  accessibilityNeeds?: string; dmNotes?: string; playedBefore?: string;
}
export interface UserRole { email: string; isAdmin: boolean; name: string; photo: string }
export interface PlayerProfile {
  playerId: string; name: string; email: string; preferredCampaign: string;
  accessibilityNeeds: string; dmNotes: string; playedBefore: string; profileComplete?: boolean;
  characters: Character[];
}
export interface Character { characterName: string; characterClass: string; characterLevel: number; characterRace?: string }
export interface MyRegistrations { upcoming: RegistrationEntry[]; past: RegistrationEntry[]; characters: Character[] }
export interface RegistrationEntry {
  registrationId: string; sessionId: string; date: string; startTime: string; endTime: string;
  campaign: string; title: string; characterName: string; characterClass: string;
  characterLevel: number; status: string; attended: boolean;
}
export interface Recap { sessionId: string; date: string; campaign: string; attendees: string; attendeeCount: number; recap: string }
export interface ApiResult { success: boolean; message?: string; errors?: Record<string, string>; sessionId?: string }
export interface AdminDashboard {
  upcomingCount: number; activePlayerCount: number; sessionsThisWeek: number;
  sessionsThisMonth: number; lastBackup: string;
  thisWeekSessions: { sessionId: string; date: string; startTime: string; campaign: string; title: string; maxPlayers: number; registeredCount: number }[];
  recentLogs: { ActionType: string; Timestamp: string; Details: string }[];
}
export interface EmailPreferences {
  reminders: number; confirmations: number; cancellations: number;
  updates: number; digest: number; achievements: number;
}
export interface HealthDetail {
  status: string; uptime: number; uptimeHuman: string;
  memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number };
  database: { sizeMB: number; tables: Record<string, number> };
  lastBackup: string;
  system: { nodeVersion: string; platform: string; cpus: number; totalMemMB: number; freeMemMB: number };
  timestamp: string;
}
export interface AdminSession { sessionId: string; date: string; startTime: string; endTime: string; campaign: string; title: string; maxPlayers: number; registeredCount: number; status: string }
export interface AdminPlayer {
  PlayerID: string; Name: string; Email: string; PreferredCampaign: string;
  ActiveStatus: string; totalRegistrations: number; sessionsAttended: number;
  characters: { name: string; class: string; level: number; race?: string }[];
}
export interface PlayerHistoryEntry { characterName: string; characterClass: string; characterLevel: number; status: string; sessionDate: string; campaign: string }
export interface HistoryEntry { sessionId: string; sessionDate: string; campaign: string; attendeeCharNames: string; attendeeCount: number; recapDrafted: boolean; infoSheetDrafted: boolean; dmPostNotes: string }
export interface ConfigEntry { key: string; value: string; description: string; modified_at: string }
export interface LogsResponse { logs: { LogID: string; Timestamp: string; ActionType: string; Details: string; TriggeredBy: string }[]; total: number; page: number; totalPages: number }
export interface Notification { notification_id: string; type: string; message: string; created_at: string }
export interface Comment { comment_id: string; session_id: string; player_id: string; text: string; created_at: string; player_name: string; photo_url?: string }

// V3 types
export interface CharacterSheet {
  character_id: string; player_id: string; name: string; class: string; subclass: string;
  level: number; race: string; backstory: string; portrait_url: string;
  hp: number; max_hp: number; ac: number;
  str: number; dex: number; con: number; int_: number; wis: number; cha: number;
  proficiencies: string; equipment: string;
  gold: number; silver: number; copper: number;
  status: string; created_at: string; modified_at: string;
}
export interface CharacterSessionEntry { session_id: string; date: string; campaign: string; title: string; status: string }
export interface LootEntry {
  loot_id: string; session_id: string; character_id: string;
  item_name: string; description: string; rarity: string; quantity: number;
  gold_value: number; awarded_by: string; created_at: string;
}
export interface Campaign {
  campaign_id: string; slug: string; name: string; description: string;
  lore: string; house_rules: string; banner_url: string; world_map_url: string;
  default_tier: string; created_at: string;
}
export interface CampaignRosterEntry {
  player_id: string; name: string; photo_url: string;
  session_count: number; characters: string;
}
export interface CampaignTimelineEntry {
  session_id: string; date: string; title: string; status: string;
  dm_post_notes: string; player_count: number; characters: string;
}
export interface DiceRoll {
  roll_id: string; session_id: string; player_id: string; expression: string;
  results: string; total: number; created_at: string; player_name?: string;
}
export interface InitiativeEntry {
  entry_id: string; session_id: string; name: string; initiative: number;
  hp: number; max_hp: number; conditions: string; is_npc: number;
  player_id: string; sort_order: number;
}
export interface PlayerRecap {
  recap_id: string; session_id: string; player_id: string;
  content: string; created_at: string; player_name?: string;
}
export interface Message {
  message_id: string; from_player_id: string; to_player_id: string;
  subject: string; body: string; read: number; created_at: string;
  from_name?: string; to_name?: string;
}
export interface Achievement {
  achievement_id: string; key: string; name: string;
  description: string; icon: string; earned_at?: string;
}
export interface DiceRollResult {
  success: boolean; roll_id: string; expression: string;
  results: number[]; total: number; modifier: number;
  player_name: string; created_at: string;
}
export interface PlayerPublicProfile {
  player_id: string; name: string; photo_url: string;
  characters: CharacterSheet[]; campaigns: string[];
  session_count: number; achievements: Achievement[];
}
export interface AnalyticsData {
  sessionsPerMonth: { month: string; count: number }[];
  avgAttendance: number; campaignDistribution: { campaign: string; count: number }[];
  busiestDay: string; playerRetention: number;
  topPlayers: { name: string; sessions: number }[];
}
export interface PlayerStats {
  totalSessions: number; attendanceRate: number; streak: number;
  campaignDistribution: { campaign: string; count: number }[];
  levelProgression: { date: string; level: number }[];
  mostPlayedCharacter: string;
}

// V4 types
export interface SessionPrep {
  session_id: string; previously_on: string; key_npcs: string;
  scenes_planned: string; secrets: string; possible_loot: string;
  dm_teaser: string; foundry_scene: string; map_screenshot_url: string;
}
export interface ObsidianExport {
  markdown: string; session: unknown; history: unknown; prep: SessionPrep | null;
  loot: LootEntry[]; moments: SessionMoment[]; journals: JournalEntry[];
}
export interface CampaignExport { campaign: string; files: { path: string; content: string }[] }
export interface SessionChecklist {
  session_id: string; recap_written: number; attendance_confirmed: number;
  characters_leveled: number; foundry_loaded: number; prep_reviewed: number;
  loot_prepared: number; music_set: number;
}
export interface SessionMoment { moment_id: string; session_id: string; timestamp: string; type: string; description: string }
export interface AvailabilityPoll { poll_id: string; campaign_id: string; campaign_name: string; title: string; options: string[]; status: string; created_at: string }
export interface AvailabilityPollDetail extends AvailabilityPoll { votes: { player_name: string; selected_options: string[] }[] }
export interface JournalEntry { journal_id: string; character_id: string; player_id: string; session_id: string; title: string; content: string; dm_comment: string; created_at: string; char_name?: string }
export interface DowntimeAction {
  action_id: string; character_id: string; player_id: string; campaign_id: string;
  type: string; description: string; goal: string; duration: string;
  status: string; dm_notes: string; reward: string;
  character_name?: string; player_name?: string; created_at: string; resolved_at: string;
}
export interface DiscussionThread {
  thread_id: string; campaign_id: string; player_id: string; title: string;
  pinned: number; locked: number; author_name: string; author_photo: string;
  post_count: number; last_post_at: string; created_at: string;
}
export interface DiscussionPost { post_id: string; thread_id: string; player_id: string; content: string; author_name: string; author_photo: string; created_at: string }
export interface DiscussionThreadDetail extends DiscussionThread { posts: DiscussionPost[] }
export interface Questionnaire { questionnaire_id: string; campaign_id: string; campaign_name: string; title: string; questions: string[]; created_at: string }
export interface QuestionnaireResponse { response_id: string; questionnaire_id: string; player_id: string; player_name: string; answers: Record<string, string>; created_at: string }
export interface WorldStateEntry { state_id: string; campaign_id: string; fact: string; value: string; session_date: string; session_title: string; changed_at: string }
export interface HomeworkEntry { player_id: string; session_id: string; date: string; campaign: string; title: string; recap_read: number; journal_written: number; downtime_submitted: number; character_updated: number }
export interface SessionRequest {
  request_id: string; campaign_id: string; player_id: string; player_name: string;
  photo_url: string; campaign_name: string; preferred_date: string; message: string;
  upvotes: number; vote_count: number; status: string; created_at: string;
}
