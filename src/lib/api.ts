import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// --- Request interceptor: attach JWT ---
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = Cookies.get('access_token');
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
      const refresh = Cookies.get('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
          Cookies.set('access_token', data.data.access_token, { expires: 1 / 3 }); // 8 hours
          notifyTokenRefreshed();
          if (original.headers) original.headers.Authorization = `Bearer ${data.data.access_token}`;
          return apiClient(original);
        } catch {
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
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
    apiClient.delete('/auth/2fa/disable', { data: { code } }),
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
  getBreakStatus: () =>
    apiClient.get('/attendance/break/status'),
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
  getMyRequests: () =>
    apiClient.get('/leave/requests/me'),
  getTeamRequests: () =>
    apiClient.get('/leave/requests/team'),
  getAllRequests: (params?: { status?: string; department?: string }) =>
    apiClient.get('/leave/requests', { params }),
  submit: (data: { leave_type: string; start_date: string; end_date: string; reason: string; leave_start_time?: string; leave_end_time?: string }) =>
    apiClient.post('/leave/requests', data),
  cancel: (id: string) =>
    apiClient.delete(`/leave/requests/${id}`),
  approve: (id: string) =>
    apiClient.put(`/leave/requests/${id}/approve`),
  reject: (id: string, reason: string) =>
    apiClient.put(`/leave/requests/${id}/reject`, { reason }),
  getMyBalance: () =>
    apiClient.get('/leave/balance/me'),
  getEmployeeBalance: (userId: string) =>
    apiClient.get(`/leave/balance/${userId}`),
  adjustBalance: (userId: string, data: { leave_type_id: string; adjustment: number; reason: string }) =>
    apiClient.put(`/leave/balance/${userId}`, data),
  getCalendar: () =>
    apiClient.get('/leave/calendar'),
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
  publishSchedule: (weekStart: string) =>
    apiClient.post('/shifts/schedule/publish', { week_start: weekStart }),
  getAssignments: (params?: { week_start?: string; department?: string }) =>
    apiClient.get('/shifts/assignments', { params }),
  getAssignmentDetail: (id: string) =>
    apiClient.get(`/shifts/assignments/${id}/detail`),
  deleteAssignment: (id: string) =>
    apiClient.delete(`/shifts/assignments/${id}`),
  assignShift: (data: { user_id: string; shift_id: string; date: string }) =>
    apiClient.post('/shifts/assignments', data),
  getSwapRequests: () =>
    apiClient.get('/shifts/swaps'),
  approveSwap: (id: string) =>
    apiClient.put(`/shifts/swaps/${id}/approve`),
  rejectSwap: (id: string, reason: string) =>
    apiClient.put(`/shifts/swaps/${id}/reject`, { reason }),
  aiSchedule: (description: string, weekStart?: string, department?: string) =>
    apiClient.post('/shifts/ai-schedule', { description, week_start: weekStart, department }),
  getBreaks: (shiftId: string) =>
    apiClient.get(`/shifts/${shiftId}/breaks`),
  addBreak: (shiftId: string, data: Record<string, unknown>) =>
    apiClient.post(`/shifts/${shiftId}/breaks`, data),
  updateBreak: (shiftId: string, breakId: string, data: Record<string, unknown>) =>
    apiClient.put(`/shifts/${shiftId}/breaks/${breakId}`, data),
  deleteBreak: (shiftId: string, breakId: string) =>
    apiClient.delete(`/shifts/${shiftId}/breaks/${breakId}`),
};

// ─── PAYROLL ──────────────────────────────────────────
export const payrollApi = {
  getPayrolls: (params?: { month?: number; year?: number }) =>
    apiClient.get('/payroll', { params }),
  getPayroll: (id: string) =>
    apiClient.get(`/payroll/${id}`),
  generate: (month: number, year: number) =>
    apiClient.post('/payroll/generate', { month, year }),
  process: (month: number, year: number) =>
    apiClient.post('/payroll/process', { month, year }),
  processFull: (month: number, year: number) =>
    apiClient.post('/payroll/process-full', { month, year }),
  adjust: (id: string, data: { field: string; value: number; reason: string }) =>
    apiClient.put(`/payroll/${id}/adjust`, data),
  getMyPayslips: () =>
    apiClient.get('/payroll/me'),
  getPayslip: (id: string) =>
    apiClient.get(`/payroll/payslips/${id}`),
  downloadPayslip: (id: string) =>
    apiClient.get(`/payroll/payslips/${id}/download`),
};

// ─── PERFORMANCE ──────────────────────────────────────
export const performanceApi = {
  getGoals: (userId?: string) =>
    apiClient.get('/performance/goals', { params: userId ? { user_id: userId } : {} }),
  createGoal: (data: Record<string, unknown>) =>
    apiClient.post('/performance/goals', data),
  updateGoal: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/performance/goals/${id}`, data),
  getReviews: (params?: { month?: string; department?: string }) =>
    apiClient.get('/performance/reviews', { params }),
  submitReview: (userId: string, data: { score: number; comments: string; month: string }) =>
    apiClient.post(`/performance/reviews/${userId}`, data),
  getInsights: (userId: string) =>
    apiClient.get(`/performance/reviews/${userId}/insights`),
};

// ─── REMOTE SESSIONS ──────────────────────────────────
export const remoteApi = {
  getSessions: (params?: { status?: string }) =>
    apiClient.get('/attendance/remote/sessions', { params }),
  getMySessions: () =>
    apiClient.get('/attendance/remote/sessions/me'),
  approveSession: (id: string) =>
    apiClient.put(`/attendance/remote/sessions/${id}/approve`),
  rejectSession: (id: string) =>
    apiClient.put(`/attendance/remote/sessions/${id}/reject`),
  getMonitor: () =>
    apiClient.get('/attendance/remote/monitor'),
  getSessionLogs: (id: string) =>
    apiClient.get(`/attendance/remote/sessions/${id}/logs`),
};

// ─── ANALYTICS ────────────────────────────────────────
export const analyticsApi = {
  getOverview: () =>
    apiClient.get('/analytics/overview'),
  getAttendanceTrend: (days?: number) =>
    apiClient.get('/analytics/attendance-trend', { params: { days: days || 30 } }),
  getLateArrivals: () =>
    apiClient.get('/analytics/late-arrivals'),
  getPayrollCost: () =>
    apiClient.get('/analytics/payroll-cost'),
  generateReport: (type: string, data: Record<string, unknown>) =>
    apiClient.post(`/reports/${type}`, data),
  downloadReport: (id: string) =>
    apiClient.get(`/reports/${id}/download`),
  // ─── Phase 2 AI ─────────────────────────────────────
  chat: (message: string) =>
    apiClient.post('/analytics/chat', { message }),
  getAnomalies: (days?: number) =>
    apiClient.get('/analytics/anomalies', { params: { days } }),
  getPayrollAnomalies: () =>
    apiClient.get('/analytics/payroll-anomalies'),
};

// ─── OVERTIME ─────────────────────────────────────────
export const overtimeApi = {
  request: (data: { attendance_id: string; reason?: string }) =>
    apiClient.post('/overtime/requests', data),
  getRequests: (params?: { status?: string }) =>
    apiClient.get('/overtime/requests', { params }),
  getMyRequests: () =>
    apiClient.get('/overtime/requests/me'),
  approveRequest: (id: string) =>
    apiClient.put(`/overtime/requests/${id}/approve`),
  rejectRequest: (id: string, reason: string) =>
    apiClient.put(`/overtime/requests/${id}/reject`, { reason }),
  getRules: () =>
    apiClient.get('/overtime/rules'),
  createRule: (data: { name: string; rule_type: string; threshold_hours: number; multiplier: number; priority?: number }) =>
    apiClient.post('/overtime/rules', data),
  updateRule: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/overtime/rules/${id}`, data),
  deleteRule: (id: string) =>
    apiClient.delete(`/overtime/rules/${id}`),
  getSummary: (week_start?: string) =>
    apiClient.get('/overtime/summary', { params: week_start ? { week_start } : {} }),
};

// ─── PUBLIC (no auth) ─────────────────────────────────
export const publicApi = {
  onboard: (data: {
    company_name: string; contact_name: string; contact_email: string;
    phone?: string; timezone?: string; company_size?: string;
  }) => apiClient.post('/public/onboard', data),
  getPlans: () => apiClient.get('/public/plans'),
  getBlogPosts: (params?: { page?: number; limit?: number; tag?: string }) =>
    apiClient.get('/public/blog', { params }),
  getBlogPost: (slug: string) => apiClient.get(`/public/blog/${slug}`),
};

// ─── PLATFORM ADMIN ───────────────────────────────────
export const adminApi = {
  getStats: () =>
    apiClient.get('/admin/stats'),
  getOrgs: () =>
    apiClient.get('/admin/orgs'),
  getPendingOrgs: () =>
    apiClient.get('/admin/orgs/pending'),
  getOrg: (id: string) =>
    apiClient.get(`/admin/orgs/${id}`),
  updateOrg: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/admin/orgs/${id}`, data),
  updatePlan: (id: string, plan: string) =>
    apiClient.patch(`/admin/orgs/${id}/plan`, { plan }),
  suspendOrg: (id: string) =>
    apiClient.patch(`/admin/orgs/${id}/suspend`),
  updateSubscription: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/admin/orgs/${id}/subscription`, data),
  extendTrial: (id: string, days: number) =>
    apiClient.post(`/admin/orgs/${id}/extend-trial`, { days }),
  activateOrg: (id: string) =>
    apiClient.post(`/admin/orgs/${id}/activate`),
  createOrg: (data: { name: string; timezone?: string; currency?: string; plan?: string }) =>
    apiClient.post('/admin/orgs', data),
  approveOrg: (id: string) =>
    apiClient.post(`/admin/orgs/${id}/approve`),
  rejectOrg: (id: string) =>
    apiClient.post(`/admin/orgs/${id}/reject`),
  getOrgUsers: (id: string) =>
    apiClient.get(`/admin/orgs/${id}/users`),
  // Plans
  getPlans: () =>
    apiClient.get('/admin/plans'),
  createPlan: (data: Record<string, unknown>) =>
    apiClient.post('/admin/plans', data),
  updatePlanDef: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/admin/plans/${id}`, data),
  deletePlan: (id: string) =>
    apiClient.delete(`/admin/plans/${id}`),
  // Blog
  getBlogPosts: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/admin/blog', { params }),
  getBlogPost: (id: string) =>
    apiClient.get(`/admin/blog/${id}`),
  createBlogPost: (data: Record<string, unknown>) =>
    apiClient.post('/admin/blog', data),
  updateBlogPost: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/admin/blog/${id}`, data),
  deleteBlogPost: (id: string) =>
    apiClient.delete(`/admin/blog/${id}`),
  togglePublish: (id: string) =>
    apiClient.patch(`/admin/blog/${id}/publish`),
  // Platform Users
  getPlatformUsers: (params?: { role?: string }) =>
    apiClient.get('/admin/users', { params }),
  getPlatformUser: (id: string) =>
    apiClient.get(`/admin/users/${id}`),
  createPlatformUser: (data: Record<string, unknown>) =>
    apiClient.post('/admin/users', data),
  updatePlatformUser: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/admin/users/${id}`, data),
  deletePlatformUser: (id: string) =>
    apiClient.delete(`/admin/users/${id}`),
};

// ─── ORG SETTINGS ─────────────────────────────────────
export const orgApi = {
  getSettings: () =>
    apiClient.get('/org/settings'),
  updateSettings: (data: Record<string, unknown>) =>
    apiClient.put('/org/settings', data),
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
  getDepartments: () =>
    apiClient.get('/org/departments'),
};

// ─── ORG RBAC ─────────────────────────────────────────
export const orgRbacApi = {
  getPermissionCatalog: () =>
    apiClient.get('/org/permissions'),
  getRoles: () =>
    apiClient.get('/org/roles'),
  createRole: (data: { name: string; slug: string; permission_keys?: string[] }) =>
    apiClient.post('/org/roles', data),
  updateRole: (id: string, data: { name: string }) =>
    apiClient.put(`/org/roles/${id}`, data),
  updateRolePermissions: (id: string, permission_keys: string[]) =>
    apiClient.put(`/org/roles/${id}/permissions`, { permission_keys }),
  deleteRole: (id: string) =>
    apiClient.delete(`/org/roles/${id}`),
  assignUserRole: (userId: string, org_role_id: string, sync_legacy_role = true) =>
    apiClient.put(`/org/users/${userId}/role`, { org_role_id, sync_legacy_role }),
  ensureSystemRoles: () =>
    apiClient.post('/org/roles/ensure-system'),
};

export const notificationApi = {
  getAll: (page = 1, limit = 20, unread?: boolean) =>
    apiClient.get('/notifications', { params: { page, limit, ...(unread ? { unread: 'true' } : {}) } }),
  getCount: () =>
    apiClient.get('/notifications/count'),
  markRead: (id: string) =>
    apiClient.put(`/notifications/${id}/read`),
  markAllRead: () =>
    apiClient.put('/notifications/read-all'),
  delete: (id: string) =>
    apiClient.delete(`/notifications/${id}`),
};
