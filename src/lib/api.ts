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
apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = getRefreshToken();
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
          const newToken = data.data.access_token;
          // Preserve remember-me state
          const wasRemembered = Cookies.get(REMEMBER_ME_KEY) === 'true';
          storeTokens(newToken, refresh, wasRemembered);
          notifyTokenRefreshed();
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
  getAll: (params?: { page?: number; limit?: number; department?: string; role?: string; status?: string }) =>
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
  importCSV: (formData: FormData) =>
    apiClient.post('/users/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
  getReport: (params: { start_date: string; end_date: string; department?: string; user_ids?: string[] }) =>
    apiClient.get('/attendance/report', { params }),
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
};

// ─── LEAVE ────────────────────────────────────────────
export const leaveApi = {
  getAllRequests: () =>
    apiClient.get('/leave/requests/all'),
  getTeamRequests: () =>
    apiClient.get('/leave/requests/team'),
  getMyBalance: () =>
    apiClient.get('/leave/balance/me'),
  submit: (data: Record<string, unknown>) =>
    apiClient.post('/leave/request', data),
  approve: (id: string) =>
    apiClient.post(`/leave/requests/${id}/approve`),
  reject: (id: string, reason: string) =>
    apiClient.post(`/leave/requests/${id}/reject`, { reason }),
};

// ─── SHIFTS ───────────────────────────────────────────
export const shiftsApi = {
  getTemplates: () =>
    apiClient.get('/shifts/templates'),
  createTemplate: (data: Record<string, unknown>) =>
    apiClient.post('/shifts/templates', data),
  updateTemplate: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/shifts/templates/${id}`, data),
  deleteTemplate: (id: string) =>
    apiClient.delete(`/shifts/templates/${id}`),
  getAssignments: (params?: { week_start?: string }) =>
    apiClient.get('/shifts/assignments', { params }),
  assignShift: (data: { user_id: string; shift_id: string; date: string }) =>
    apiClient.post('/shifts/assign', data),
  deleteAssignment: (id: string) =>
    apiClient.delete(`/shifts/assignments/${id}`),
  publishSchedule: (week_start: string) =>
    apiClient.post('/shifts/publish', { week_start }),
  aiSchedule: (prompt: string, week_start: string) =>
    apiClient.post('/shifts/ai-schedule', { prompt, week_start }),
  getBreaks: (shiftId: string) =>
    apiClient.get(`/shifts/${shiftId}/breaks`),
  addBreak: (shiftId: string, data: Record<string, unknown>) =>
    apiClient.post(`/shifts/${shiftId}/breaks`, data),
  deleteBreak: (shiftId: string, breakId: string) =>
    apiClient.delete(`/shifts/${shiftId}/breaks/${breakId}`),
  getSwapRequests: () =>
    apiClient.get('/shifts/swaps'),
  approveSwap: (id: string) =>
    apiClient.post(`/shifts/swaps/${id}/approve`),
  rejectSwap: (id: string, reason: string) =>
    apiClient.post(`/shifts/swaps/${id}/reject`, { reason }),
};

// ─── PAYROLL ──────────────────────────────────────────
export const payrollApi = {
  getPayrolls: () =>
    apiClient.get('/payroll'),
  generate: (month: number, year: number) =>
    apiClient.post('/payroll/generate', { month, year }),
  processFull: (month: number, year: number) =>
    apiClient.post('/payroll/process', { month, year }),
  adjust: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/payroll/${id}/adjust`, data),
  downloadPayslip: (recordId: string) =>
    apiClient.get(`/payroll/payslip/${recordId}/download`, { responseType: 'blob' }),
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
    apiClient.get(`/performance/insights/${userId}`),
};

// ─── OVERTIME ─────────────────────────────────────────
export const overtimeApi = {
  getMyRequests: () =>
    apiClient.get('/overtime/me'),
  getRequests: (params?: { status?: string }) =>
    apiClient.get('/overtime/requests', { params }),
  getSummary: () =>
    apiClient.get('/overtime/summary'),
  request: (data: Record<string, unknown>) =>
    apiClient.post('/overtime/request', data),
  approveRequest: (id: string) =>
    apiClient.post(`/overtime/requests/${id}/approve`),
  rejectRequest: (id: string, reason: string) =>
    apiClient.post(`/overtime/requests/${id}/reject`, { reason }),
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
    apiClient.get('/remote/sessions', { params }),
  approveSession: (id: string) =>
    apiClient.post(`/remote/sessions/${id}/approve`),
  rejectSession: (id: string) =>
    apiClient.post(`/remote/sessions/${id}/reject`),
  getMonitor: () =>
    apiClient.get('/remote/monitor'),
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
  generateReport: (type: string, params: Record<string, unknown>) =>
    apiClient.post('/analytics/reports/generate', { type, ...params }),
  downloadReport: (id: string) =>
    apiClient.get(`/analytics/reports/${id}/download`, { responseType: 'blob' }),
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
    apiClient.get('/org/office-networks'),
  updateOfficeIPs: (ips: string[]) =>
    apiClient.put('/org/office-ips', { ips }),
  updateOfficeSSIDs: (ssids: string[]) =>
    apiClient.put('/org/office-ssids', { ssids }),
  detectMyIp: () =>
    apiClient.get('/org/detect-ip'),
  getWhatsAppSettings: () =>
    apiClient.get('/org/whatsapp'),
  updateWhatsAppSettings: (data: Record<string, unknown>) =>
    apiClient.put('/org/whatsapp', data),
  testWhatsApp: () =>
    apiClient.post('/org/whatsapp/test'),
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
    apiClient.post('/org/roles/seed'),
  getPermissionCatalog: () =>
    apiClient.get('/org/permissions/catalog'),
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
  getOrgs: () =>
    apiClient.get('/admin/orgs'),
  getPendingOrgs: () =>
    apiClient.get('/admin/orgs', { params: { status: 'pending' } }),
  getOrg: (id: string) =>
    apiClient.get(`/admin/orgs/${id}`),
  getOrgUsers: (id: string) =>
    apiClient.get(`/admin/orgs/${id}/users`),
  createOrg: (data: Record<string, unknown>) =>
    apiClient.post('/admin/orgs', data),
  updateOrg: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/admin/orgs/${id}`, data),
  updateSubscription: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/admin/orgs/${id}/subscription`, data),
  approveOrg: (id: string) =>
    apiClient.post(`/admin/orgs/${id}/approve`),
  rejectOrg: (id: string) =>
    apiClient.post(`/admin/orgs/${id}/reject`),
  suspendOrg: (id: string) =>
    apiClient.post(`/admin/orgs/${id}/suspend`),
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
    apiClient.get('/admin/platform-users'),
  createPlatformUser: (data: Record<string, unknown>) =>
    apiClient.post('/admin/platform-users', data),
  updatePlatformUser: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/admin/platform-users/${id}`, data),
  deletePlatformUser: (id: string) =>
    apiClient.delete(`/admin/platform-users/${id}`),
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
};
