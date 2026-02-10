// API client — all fetch calls to Express backend

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok && res.status === 401) throw new Error('Not authenticated');
  return res.json();
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
export const getMyNotifications = () => fetchJson<{ notifications: Notification[]; unread: number }>('/api/me/notifications');
export const markAllNotificationsRead = () => fetchJson<ApiResult>('/api/me/notifications/read-all', { method: 'POST' });
export const cancelByToken = (token: string) => fetchJson<ApiResult>('/api/cancel-by-token', { method: 'POST', body: JSON.stringify({ token }) });
export const getSessionComments = (id: string) => fetchJson<Comment[]>(`/api/sessions/${id}/comments`);
export const postSessionComment = (id: string, text: string) => fetchJson<ApiResult>(`/api/sessions/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) });

// ── Admin ──
export const getAdminDashboard = () => fetchJson<AdminDashboard>('/api/admin/dashboard');
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

