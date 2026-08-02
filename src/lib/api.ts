import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// ─── Token storage helpers (cookies for Middleware) ───────────────
const ACCESS_TOKEN_KEY  = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const REMEMBER_ME_KEY   = 'remember_me';

export function getAccessToken(): string | null {
  return Cookies.get(ACCESS_TOKEN_KEY) || null;
}

export function getRefreshToken(): string | null {
  return Cookies.get(REFRESH_TOKEN_KEY) || null;
}

export function storeTokens(accessToken: string, refreshToken: string, rememberMe = false): void {
  const options: Cookies.CookieAttributes = {
    path: '/',
    sameSite: 'lax',
    secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
  };

  if (rememberMe) {
    options.expires = 30; // 30 days
    Cookies.set(REMEMBER_ME_KEY, 'true', options);
  } else {
    Cookies.remove(REMEMBER_ME_KEY);
  }

  Cookies.set(ACCESS_TOKEN_KEY, accessToken, options);
  Cookies.set(REFRESH_TOKEN_KEY, refreshToken, options);
}

export function clearTokens(): void {
  Cookies.remove(ACCESS_TOKEN_KEY, { path: '/' });
  Cookies.remove(REFRESH_TOKEN_KEY, { path: '/' });
  Cookies.remove(REMEMBER_ME_KEY, { path: '/' });
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// --- Request interceptor: attach JWT ---
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Notify auth layer when access token is refreshed (re-fetch capabilities)
type TokenRefreshListener = () => void;
const tokenRefreshListeners = new Set<TokenRefreshListener>();

export function onAccessTokenRefreshed(listener: TokenRefreshListener): () => void {
  tokenRefreshListeners.add(listener);
  return () => tokenRefreshListeners.delete(listener);
}

function notifyTokenRefreshed() {
  tokenRefreshListeners.forEach(fn => fn());
}

// --- Response interceptor: handle 401 refresh ---
// Single-flight refresh: when several requests 401 at once (e.g. a page firing
// parallel queries with an expired token), only ONE refresh call goes out and
// the rest await it. Without this they race, and a losing request can clear
// freshly-stored tokens and bounce the user to /login.
let refreshInFlight: Promise<string> | null = null;

function refreshAccessToken(refreshToken: string): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      .then(({ data }) => {
        const newToken = data.data.access_token as string;
        // Rotation: the server consumes the presented refresh token and
        // returns a successor — storing the old one would trigger reuse
        // detection (family revocation) on the next refresh.
        const rotated = (data.data.refresh_token as string | undefined) ?? refreshToken;
        // Preserve remember-me state
        const wasRemembered = Cookies.get(REMEMBER_ME_KEY) === 'true';
        storeTokens(newToken, rotated, wasRemembered);
        notifyTokenRefreshed();
        return newToken;
      })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = getRefreshToken();
      if (refresh) {
        try {
          const newToken = await refreshAccessToken(refresh);
          if (original.headers) original.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(original);
        } catch {
          clearTokens();
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── AUTH ─────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  logout: () =>
    apiClient.post('/auth/logout'),
  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    apiClient.post('/auth/reset-password', { token, password }),
  setupAccount: (token: string, password: string) =>
    apiClient.post('/auth/setup-account', { token, password }),
  refreshToken: (refresh_token: string) =>
    apiClient.post('/auth/refresh', { refresh_token }),
  // ─── 2FA ──────────────────────────────────────────────
  setup2FA: () =>
    apiClient.post('/auth/2fa/setup'),
  verify2FA: (code: string) =>
    apiClient.post('/auth/2fa/verify', { code }),
  authenticate2FA: (partial_token: string, code: string) =>
    apiClient.post('/auth/2fa/authenticate', { partial_token, code }),
  disable2FA: (code: string) =>
    apiClient.delete('/auth/2fa', { data: { code } }),
  // ─── SSO ──────────────────────────────────────────────
  exchangeSSOCode: (code: string) =>
    apiClient.post('/auth/sso/exchange', { code }),
};

// ─── USERS ────────────────────────────────────────────
export const usersApi = {
  // `q` is the cross-endpoint search contract; sort ∈ name,email,department,job_title,joined_at,created_at
  getAll: (params?: { page?: number; limit?: number; department?: string; role?: string; status?: string; q?: string; sort?: string; order?: 'asc' | 'desc' }) =>
    apiClient.get('/users', { params }),
  getOne: (id: string) =>
    apiClient.get(`/users/${id}`),
  getMe: () =>
    apiClient.get('/users/me'),
  getMyCapabilities: () =>
    apiClient.get('/users/me/capabilities'),
  create: (data: Record<string, unknown>) =>
    apiClient.post('/users', data),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/users/${id}`, data),
  updateMe: (data: Record<string, unknown>) =>
    apiClient.put('/users/me', data),
  deactivate: (id: string) =>
    apiClient.patch(`/users/${id}/deactivate`),
  // Backend expects a parsed JSON array, not a file upload.
  // Returns { created, skipped, errors }.
  import: (users: Array<{ name: string; email: string; role?: string; department?: string; phone?: string }>) =>
    apiClient.post('/users/import', { users }),
  getPermissions: (id: string) =>
    apiClient.get(`/users/${id}/permissions`),
  updatePermissions: (id: string, grants: Array<{ permission_key: string; effect: 'allow' | 'deny' }>) =>
    apiClient.put(`/users/${id}/permissions`, { grants }),
};

// ─── ATTENDANCE ───────────────────────────────────────
export const attendanceApi = {
  getToday: (params?: { date?: string }) =>
    apiClient.get('/attendance/today', { params }),
  getMe: (params?: { days?: number }) =>
    apiClient.get('/attendance/me', { params }),
  getEmployee: (userId: string, params?: { start?: string; end?: string }) =>
    apiClient.get(`/attendance/${userId}`, { params }),
  checkIn: (data?: { type?: 'manual' | 'qr'; qr_code?: string }) =>
    apiClient.post('/attendance/checkin', data),
  checkOut: () =>
    apiClient.post('/attendance/checkout'),
  override: (id: string, data: { check_in_at?: string; check_out_at?: string; reason: string }) =>
    apiClient.put(`/attendance/${id}/override`, data),
  getReport: (params: { start_date: string; end_date: string; department?: string }) =>
    apiClient.get('/attendance/report/export', { params }),
  getQRCode: () =>
    apiClient.get('/org/qr-code'),
  regenerateQR: () =>
    apiClient.post('/org/qr-code/regenerate'),
  startBreak: (break_type?: string, shift_break_id?: string) =>
    apiClient.post('/attendance/break/start', { break_type, shift_break_id }),
  endBreak: () =>
    apiClient.post('/attendance/break/end'),
  getTodayStatus: () =>
    apiClient.get('/attendance/today-status'),
  getLeaveCheck: () =>
    apiClient.get('/attendance/leave-check'),
  submitLateNotice: (data: { date: string; expected_time: string; reason: string }) =>
    apiClient.post('/attendance/late-notice', data),
  getMyLateNotices: (params?: { days?: number }) =>
    apiClient.get('/attendance/late-notice/me', { params }),
  getLateNotices: (params?: { status?: string }) =>
    apiClient.get('/attendance/late-notices', { params }),
  acknowledgeLateNotice: (id: string) =>
    apiClient.put(`/attendance/late-notice/${id}/acknowledge`),
  cancelLateNotice: (id: string) =>
    apiClient.delete(`/attendance/late-notice/${id}`),
  getCorrections: (params?: { status?: 'pending' | 'approved' | 'rejected' | 'all' }) =>
    apiClient.get('/attendance/corrections', { params }),
  approveCorrection: (id: string, note?: string) =>
    apiClient.put(`/attendance/corrections/${id}/approve`, { note }),
  rejectCorrection: (id: string, note?: string) =>
    apiClient.put(`/attendance/corrections/${id}/reject`, { note }),
};

// ─── LEAVE ────────────────────────────────────────────
export const leaveApi = {
  // Pagination is opt-in: pass page/limit for the { data, pagination } envelope;
  // without them the full list is returned. sort ∈ created_at,start_date,end_date,status,leave_type
  getAllRequests: (params?: { status?: string; department?: string; q?: string; page?: number; limit?: number; sort?: string; order?: 'asc' | 'desc' }) =>
    apiClient.get('/leave/requests', { params }),
  getTeamRequests: () =>
    apiClient.get('/leave/requests/team'),
  getMyBalance: () =>
    apiClient.get('/leave/balance/me'),
  submit: (data: Record<string, unknown>) =>
    apiClient.post('/leave/requests', data),
  approve: (id: string) =>
    apiClient.put(`/leave/requests/${id}/approve`),
  reject: (id: string, reason: string) =>
    apiClient.put(`/leave/requests/${id}/reject`, { reason }),
};

// ─── SHIFTS ───────────────────────────────────────────
export const shiftsApi = {
  getTemplates: () =>
    apiClient.get('/shifts'),
  createTemplate: (data: Record<string, unknown>) =>
    apiClient.post('/shifts', data),
  updateTemplate: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/shifts/${id}`, data),
  deleteTemplate: (id: string) =>
    apiClient.delete(`/shifts/${id}`),
  setDefault: (id: string) =>
    apiClient.put(`/shifts/${id}/set-default`),
  setOrgWide: (id: string, org_wide = true) =>
    apiClient.put(`/shifts/${id}/set-org-wide`, { org_wide }),
  getAssignments: (params?: { week_start?: string; department?: string }) =>
    apiClient.get('/shifts/assignments', { params }),
  assignShift: (data: { user_id: string; shift_id: string; date: string }) =>
    apiClient.post('/shifts/assignments', data),
  deleteAssignment: (id: string) =>
    apiClient.delete(`/shifts/assignments/${id}`),
  publishSchedule: (from_date: string, to_date: string) =>
    apiClient.post('/shifts/schedule/publish', { from_date, to_date }),
  aiSchedule: (description: string, week_start: string) =>
    apiClient.post('/shifts/ai-schedule', { description, week_start }),
  getBreaks: (shiftId: string) =>
    apiClient.get(`/shifts/${shiftId}/breaks`),
  addBreak: (shiftId: string, data: Record<string, unknown>) =>
    apiClient.post(`/shifts/${shiftId}/breaks`, data),
  deleteBreak: (shiftId: string, breakId: string) =>
    apiClient.delete(`/shifts/${shiftId}/breaks/${breakId}`),
  getSwapRequests: (params?: { status?: string }) =>
    apiClient.get('/shifts/swaps', { params }),
  approveSwap: (id: string) =>
    apiClient.put(`/shifts/swaps/${id}/approve`),
  rejectSwap: (id: string, reason: string) =>
    apiClient.put(`/shifts/swaps/${id}/reject`, { reason }),
};

// ─── PAYROLL ──────────────────────────────────────────
export const payrollApi = {
  getPayrolls: () =>
    apiClient.get('/payroll'),
  generate: (month: number, year: number) =>
    apiClient.post('/payroll/generate', { month, year }),
  processFull: (month: number, year: number) =>
    apiClient.post('/payroll/process-full', { month, year }),
  adjust: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/payroll/${id}/adjust`, data),
  // Returns { url } — a presigned S3 link to the payslip PDF.
  downloadPayslip: (recordId: string) =>
    apiClient.get(`/payroll/payslips/${recordId}/download`),
};

// ─── PERFORMANCE ──────────────────────────────────────
export const performanceApi = {
  getGoals: () =>
    apiClient.get('/performance/goals'),
  updateGoal: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/performance/goals/${id}`, data),
  getReviews: (params?: { month?: string }) =>
    apiClient.get('/performance/reviews', { params }),
  submitReview: (userId: string, data: Record<string, unknown>) =>
    apiClient.post(`/performance/reviews/${userId}`, data),
  getInsights: (userId: string) =>
    apiClient.get(`/performance/reviews/${userId}/insights`),
};

// ─── OVERTIME ─────────────────────────────────────────
export const overtimeApi = {
  getMyRequests: () =>
    apiClient.get('/overtime/requests/me'),
  getRequests: (params?: { status?: string }) =>
    apiClient.get('/overtime/requests', { params }),
  getSummary: () =>
    apiClient.get('/overtime/summary'),
  request: (data: Record<string, unknown>) =>
    apiClient.post('/overtime/requests', data),
  approveRequest: (id: string) =>
    apiClient.put(`/overtime/requests/${id}/approve`),
  rejectRequest: (id: string, reason: string) =>
    apiClient.put(`/overtime/requests/${id}/reject`, { reason }),
  getRules: () =>
    apiClient.get('/overtime/rules'),
  createRule: (data: Record<string, unknown>) =>
    apiClient.post('/overtime/rules', data),
  updateRule: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/overtime/rules/${id}`, data),
  deleteRule: (id: string) =>
    apiClient.delete(`/overtime/rules/${id}`),
};

// ─── REMOTE ───────────────────────────────────────────
export const remoteApi = {
  getSessions: (params?: { status?: string }) =>
    apiClient.get('/attendance/remote/sessions', { params }),
  approveSession: (id: string) =>
    apiClient.put(`/attendance/remote/sessions/${id}/approve`),
  rejectSession: (id: string) =>
    apiClient.put(`/attendance/remote/sessions/${id}/reject`),
  getMonitor: () =>
    apiClient.get('/attendance/remote/monitor'),
};

// ─── EXPENSES ─────────────────────────────────────────
export const expensesApi = {
  getMine: () =>
    apiClient.get('/expenses/me'),
  getAll: (params?: { status?: 'pending' | 'approved' | 'rejected' | 'reimbursed' | 'all' }) =>
    apiClient.get('/expenses', { params }),
  create: (data: { amount: number; category: string; description: string; expense_date: string; currency?: string; receipt_url?: string }) =>
    apiClient.post('/expenses', data),
  approve: (id: string, note?: string) =>
    apiClient.put(`/expenses/${id}/approve`, { note }),
  reject: (id: string, note?: string) =>
    apiClient.put(`/expenses/${id}/reject`, { note }),
  // Adds the approved amount to the claimant's payroll record for month/year.
  reimburse: (id: string, month: number, year: number) =>
    apiClient.post(`/expenses/${id}/reimburse`, { month, year }),
};

// ─── DOCUMENTS ────────────────────────────────────────
export const documentsApi = {
  // Step 1: presigned S3 PUT url. The actual upload must be a raw fetch PUT
  // to upload_url carrying exactly the returned Content-Type header — never
  // the axios client (no Authorization header on the S3 request).
  getUploadUrl: (data: { user_id?: string; file_name: string; mime_type: string; file_size: number }) =>
    apiClient.post('/documents/upload-url', data),
  // Step 3: register the document after the S3 PUT succeeded.
  register: (data: {
    user_id?: string; title: string; category: string;
    file_key: string; file_name: string; file_size: number; mime_type: string;
    expires_at?: string; // YYYY-MM-DD
  }) =>
    apiClient.post('/documents', data),
  getMine: () =>
    apiClient.get('/documents/me'),
  // Requires documents.view_team
  getForUser: (userId: string) =>
    apiClient.get(`/documents/user/${userId}`),
  // Returns { download_url, file_name, mime_type, expires_in }
  download: (id: string) =>
    apiClient.get(`/documents/${id}/download`),
  remove: (id: string) =>
    apiClient.delete(`/documents/${id}`),
};

// ─── ONBOARDING ───────────────────────────────────────
export interface OnboardingTemplateItemInput {
  title: string;
  description?: string | null;
  due_days?: number | null;
  sort_order?: number;
  assignee_role?: 'employee' | 'manager';
}

export interface OnboardingTemplateInput {
  name: string;
  is_default?: boolean;
  items: OnboardingTemplateItemInput[]; // 1–50 items
}

export const onboardingApi = {
  // Template CRUD + assignment require onboarding.manage
  getTemplates: () =>
    apiClient.get('/onboarding/templates'),
  createTemplate: (data: OnboardingTemplateInput) =>
    apiClient.post('/onboarding/templates', data),
  // Replaces fields and items wholesale
  updateTemplate: (id: string, data: OnboardingTemplateInput) =>
    apiClient.put(`/onboarding/templates/${id}`, data),
  deleteTemplate: (id: string) =>
    apiClient.delete(`/onboarding/templates/${id}`),
  // Idempotent per (user, template) → { created, skipped }
  assign: (data: { user_id: string; template_id: string }) =>
    apiClient.post('/onboarding/assign', data),
  // Tasks assigned to the caller (own onboarding + manager-side items
  // for their hires), pending first
  getMine: () =>
    apiClient.get('/onboarding/me'),
  // Requires onboarding.view_team → { user, tasks, progress }
  getForUser: (userId: string) =>
    apiClient.get(`/onboarding/user/${userId}`),
  // Allowed for the task's assignee or onboarding.manage
  completeTask: (id: string) =>
    apiClient.put(`/onboarding/tasks/${id}/complete`),
  skipTask: (id: string) =>
    apiClient.put(`/onboarding/tasks/${id}/skip`),
};

// ─── ANNOUNCEMENTS ────────────────────────────────────
export const announcementsApi = {
  // Requires org.announcements.send → { announcement, count, message }
  send: (data: { title: string; body: string; department_id?: string; scheduled_for?: string }) =>
    apiClient.post('/performance/announcements', data),
  // Published announcements targeted at the caller, each with my_read_at
  getAll: () =>
    apiClient.get('/performance/announcements'),
  // Idempotent read receipt
  markRead: (id: string) =>
    apiClient.post(`/performance/announcements/${id}/read`),
  // Requires org.announcements.send → { read_count, audience_count, readers }
  getReceipts: (id: string) =>
    apiClient.get(`/performance/announcements/${id}/receipts`),
};

// ─── KUDOS ────────────────────────────────────────────
export const kudosApi = {
  // Any org member. 429 RATE_LIMITED at 20/day, 422 for self-kudos.
  give: (data: { to_user_id: string; message: string; emoji?: string }) =>
    apiClient.post('/kudos', data),
  // Org feed, newest first. Pagination is opt-in via page/limit; a plain
  // call returns the latest 100.
  getFeed: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/kudos', { params }),
  // → { received, given, recent_received }
  getMine: () =>
    apiClient.get('/kudos/mine'),
  // Author or org.settings.update
  remove: (id: string) =>
    apiClient.delete(`/kudos/${id}`),
};

// ─── ANALYTICS ────────────────────────────────────────
export const analyticsApi = {
  getOverview: () =>
    apiClient.get('/analytics/overview'),
  getAttendanceTrend: (days: number) =>
    apiClient.get('/analytics/attendance-trend', { params: { days } }),
  getLateArrivals: () =>
    apiClient.get('/analytics/late-arrivals'),
  getPayrollCost: () =>
    apiClient.get('/analytics/payroll-cost'),
  getAnomalies: () =>
    apiClient.get('/analytics/anomalies'),
  getPayrollAnomalies: () =>
    apiClient.get('/analytics/payroll-anomalies'),
  // Returns { download_url, type, generated_at } — open download_url directly.
  generateReport: (type: string, params: Record<string, unknown>) =>
    apiClient.post(`/reports/${type}`, params),
  chat: (message: string) =>
    apiClient.post('/analytics/chat', { message }),
};

// ─── ORG ──────────────────────────────────────────────
export const orgApi = {
  getSettings: () =>
    apiClient.get('/org/settings'),
  updateSettings: (data: Record<string, unknown>) =>
    apiClient.put('/org/settings', data),
  getDepartments: () =>
    apiClient.get('/org/departments'),
  getOfficeNetworks: () =>
    apiClient.get('/org/office-ips'),
  updateOfficeIPs: (ips: string[]) =>
    apiClient.put('/org/office-ips', { ips }),
  updateOfficeSSIDs: (ssids: string[]) =>
    apiClient.put('/org/office-ssids', { ssids }),
  detectMyIp: () =>
    apiClient.get('/org/my-ip'),
  getWhatsAppSettings: () =>
    apiClient.get('/org/whatsapp'),
  updateWhatsAppSettings: (data: Record<string, unknown>) =>
    apiClient.put('/org/whatsapp', data),
  testWhatsApp: () =>
    apiClient.post('/org/whatsapp/test'),
  getAuditLogs: (params?: { page?: number; limit?: number; action?: string }) =>
    apiClient.get('/org/audit-logs', { params }),
  getHolidays: () =>
    apiClient.get('/org/holidays'),
  createHoliday: (data: { date: string; name: string; recurring?: boolean }) =>
    apiClient.post('/org/holidays', data),
  deleteHoliday: (id: string) =>
    apiClient.delete(`/org/holidays/${id}`),
  getWhosOut: (params?: { from?: string; to?: string }) =>
    apiClient.get('/org/whos-out', { params }),
};

// ─── ORG OUTBOUND WEBHOOKS ────────────────────────────
export interface OrgWebhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
  created_at: string;
}

export const orgWebhooksApi = {
  // The secret is never included in list responses.
  getAll: () =>
    apiClient.get('/org/outbound-webhooks'),
  // The response carries the signing secret ONCE — it is never shown again.
  create: (data: { url: string; events: string[] }) =>
    apiClient.post('/org/outbound-webhooks', data),
  remove: (id: string) =>
    apiClient.delete(`/org/outbound-webhooks/${id}`),
  // Returns { delivered: boolean }.
  test: (id: string) =>
    apiClient.post(`/org/outbound-webhooks/${id}/test`),
};

// ─── DEPARTMENTS ──────────────────────────────────────
export interface DepartmentNode {
  id: string;
  name: string;
  parent_id: string | null;
  member_count: number;
  created_at: string;
  children: DepartmentNode[];
}

export const departmentsApi = {
  // Flat names (legacy strings merged in) — used by dropdowns
  getNames: () =>
    apiClient.get('/org/departments'),
  getTree: () =>
    apiClient.get<{ data: DepartmentNode[] }>('/org/departments/tree'),
  create: (name: string, parent_id?: string | null) =>
    apiClient.post('/org/departments', { name, parent_id }),
  update: (id: string, data: { name?: string; parent_id?: string | null }) =>
    apiClient.put(`/org/departments/${id}`, data),
  remove: (id: string) =>
    apiClient.delete(`/org/departments/${id}`),
};

// ─── ORG RBAC ─────────────────────────────────────────
export const orgRbacApi = {
  getRoles: () =>
    apiClient.get('/org/roles'),
  createRole: (data: Record<string, unknown>) =>
    apiClient.post('/org/roles', data),
  updateRole: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/org/roles/${id}`, data),
  updateRolePermissions: (id: string, permissionKeys: string[]) =>
    apiClient.put(`/org/roles/${id}/permissions`, { permission_keys: permissionKeys }),
  deleteRole: (id: string) =>
    apiClient.delete(`/org/roles/${id}`),
  ensureSystemRoles: () =>
    apiClient.post('/org/roles/ensure-system'),
  getPermissionCatalog: () =>
    apiClient.get('/org/permissions'),
  assignUserRole: (userId: string, roleId: string, syncLegacy?: boolean) =>
    apiClient.put(`/org/users/${userId}/role`, { org_role_id: roleId, sync_legacy_role: syncLegacy }),
};

// ─── NOTIFICATIONS ────────────────────────────────────
export const notificationApi = {
  getAll: (page = 1, limit = 20) =>
    apiClient.get('/notifications', { params: { page, limit } }),
  markRead: (id: string) =>
    apiClient.put(`/notifications/${id}/read`),
  markAllRead: () =>
    apiClient.put('/notifications/read-all'),
  delete: (id: string) =>
    apiClient.delete(`/notifications/${id}`),
};

// ─── ADMIN ────────────────────────────────────────────
export const adminApi = {
  getStats: () =>
    apiClient.get('/admin/stats'),
  // Pagination is opt-in: pass page/limit for the { data, pagination } envelope;
  // without them the full list is returned. sort ∈ created_at,name,status,subscription_status
  getOrgs: (params?: { q?: string; status?: string; page?: number; limit?: number; sort?: string; order?: 'asc' | 'desc' }) =>
    apiClient.get('/admin/orgs', { params }),
  getPendingOrgs: () =>
    apiClient.get('/admin/orgs/pending'),
  getOrg: (id: string) =>
    apiClient.get(`/admin/orgs/${id}`),
  getOrgUsers: (id: string) =>
    apiClient.get(`/admin/orgs/${id}/users`),
  createOrg: (data: Record<string, unknown>) =>
    apiClient.post('/admin/orgs', data),
  updateOrg: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/admin/orgs/${id}`, data),
  updateSubscription: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/admin/orgs/${id}/subscription`, data),
  approveOrg: (id: string) =>
    apiClient.post(`/admin/orgs/${id}/approve`),
  rejectOrg: (id: string, reason?: string) =>
    apiClient.post(`/admin/orgs/${id}/reject`, { reason }),
  suspendOrg: (id: string) =>
    apiClient.patch(`/admin/orgs/${id}/suspend`),
  activateOrg: (id: string) =>
    apiClient.post(`/admin/orgs/${id}/activate`),
  extendTrial: (id: string, days: number) =>
    apiClient.post(`/admin/orgs/${id}/extend-trial`, { days }),
  getPlans: () =>
    apiClient.get('/admin/plans'),
  createPlan: (data: Record<string, unknown>) =>
    apiClient.post('/admin/plans', data),
  updatePlanDef: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/admin/plans/${id}`, data),
  deletePlan: (id: string) =>
    apiClient.delete(`/admin/plans/${id}`),
  getPlatformUsers: () =>
    apiClient.get('/admin/users'),
  createPlatformUser: (data: Record<string, unknown>) =>
    apiClient.post('/admin/users', data),
  updatePlatformUser: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/admin/users/${id}`, data),
  deletePlatformUser: (id: string) =>
    apiClient.delete(`/admin/users/${id}`),
  getBlogPosts: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/admin/blog', { params }),
  createBlogPost: (data: Record<string, unknown>) =>
    apiClient.post('/admin/blog', data),
  updateBlogPost: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/admin/blog/${id}`, data),
  deleteBlogPost: (id: string) =>
    apiClient.delete(`/admin/blog/${id}`),
  togglePublish: (id: string) =>
    apiClient.patch(`/admin/blog/${id}/publish`),
  sendAnnouncement: (data: { title: string; body: string; target_dept_id?: string }) =>
    apiClient.post('/performance/announcements', data),
  broadcast: (data: { title: string; body: string; target?: 'all' | 'super_admins' }) =>
    apiClient.post('/admin/broadcast', data),
  getAuditLogs: (params?: { page?: number; limit?: number; org_id?: string; actor_id?: string; action?: string; entity_type?: string }) =>
    apiClient.get('/admin/audit-logs', { params }),
};
