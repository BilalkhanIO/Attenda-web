import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

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
};

// ─── LEAVE ────────────────────────────────────────────
export const leaveApi = {
  getMyRequests: () =>
    apiClient.get('/leave/requests/me'),
  getTeamRequests: () =>
    apiClient.get('/leave/requests/team'),
  getAllRequests: (params?: { status?: string; department?: string }) =>
    apiClient.get('/leave/requests', { params }),
  submit: (data: { leave_type: string; start_date: string; end_date: string; reason: string }) =>
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

// ─── ANALYTICS ────────────────────────────────────────
export const analyticsApi = {
  getOverview: () =>
    apiClient.get('/analytics/overview'),
  getAttendanceTrend: (days?: number) =>
    apiClient.get('/analytics/attendance-trend', { params: { days: days || 30 } }),
  getLateArrivals: () =>
    apiClient.get('/analytics/late-arrivals'),
  getRemoteVsOffice: () =>
    apiClient.get('/analytics/remote-vs-office'),
  getLeaveUtilisation: () =>
    apiClient.get('/analytics/leave-utilisation'),
  getPayrollCost: () =>
    apiClient.get('/analytics/payroll-cost'),
  getPerformanceScores: () =>
    apiClient.get('/analytics/performance-scores'),
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

// ─── ORG SETTINGS ─────────────────────────────────────
export const orgApi = {
  getSettings: () =>
    apiClient.get('/org/settings'),
  updateSettings: (data: Record<string, unknown>) =>
    apiClient.put('/org/settings', data),
  getOfficeIPs: () =>
    apiClient.get('/org/office-ips'),
  updateOfficeIPs: (ips: string[]) =>
    apiClient.put('/org/office-ips', { ips }),
  getWhatsAppSettings: () =>
    apiClient.get('/org/whatsapp'),
  updateWhatsAppSettings: (data: Record<string, unknown>) =>
    apiClient.put('/org/whatsapp', data),
  testWhatsApp: () =>
    apiClient.post('/org/whatsapp/test'),
  getDepartments: () =>
    apiClient.get('/org/departments'),
};
