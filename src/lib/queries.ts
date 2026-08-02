import { queryOptions } from '@tanstack/react-query';
import {
  adminApi, announcementsApi, attendanceApi, documentsApi, expensesApi,
  leaveApi, overtimeApi, remoteApi, shiftsApi, usersApi, orgApi,
  performanceApi, orgRbacApi
} from './api';
import { formatDate } from './utils';
import type { AdminOrg } from './admin-shared';
import type {
  AttendanceRecord, LeaveRequest, SwapRequest, User,
  PerformanceGoal, PerformanceReview, PlanDefinition
} from '@/types';

/**
 * Query-key factory + shared queryOptions. One place owns key shapes so
 * invalidations never drift from the queries they target. The res.data.data
 * envelope unwrapping happens here — components only see typed data.
 */
export const keys = {
  attendance: {
    all: ['attendance'] as const,
    today: () => [...keys.attendance.all, 'today'] as const,
    myStatus: () => [...keys.attendance.all, 'today-status'] as const,
  },
  leave: {
    all: ['leave'] as const,
    requests: (scope: 'all' | 'team') => [...keys.leave.all, 'requests', scope] as const,
    list: (params: LeaveListParams) => [...keys.leave.requests('all'), params] as const,
    pendingCount: () => [...keys.leave.all, 'pending-count'] as const,
    myBalance: () => [...keys.leave.all, 'balance', 'me'] as const,
  },
  expenses: {
    all: ['expenses'] as const,
    mine: () => [...keys.expenses.all, 'me'] as const,
  },
  documents: {
    all: ['documents'] as const,
    mine: () => [...keys.documents.all, 'me'] as const,
    user: (userId: string) => [...keys.documents.all, 'user', userId] as const,
  },
  announcements: {
    all: ['announcements'] as const,
    list: () => [...keys.announcements.all, 'list'] as const,
    receipts: (id: string) => [...keys.announcements.all, 'receipts', id] as const,
  },
  overtime: {
    all: ['overtime'] as const,
    myRequests: () => [...keys.overtime.all, 'requests', 'me'] as const,
    pending: () => [...keys.overtime.all, 'requests', 'pending'] as const,
    summary: () => [...keys.overtime.all, 'summary'] as const,
    rules: () => [...keys.overtime.all, 'rules'] as const,
  },
  remote: {
    all: ['remote'] as const,
    monitor: () => [...keys.remote.all, 'monitor'] as const,
    pendingSessions: () => [...keys.remote.all, 'sessions', 'pending'] as const,
  },
  swaps: {
    all: ['swaps'] as const,
    list: () => [...keys.swaps.all, 'list'] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params: UsersListParams) => [...keys.users.all, 'list', params] as const,
    managers: () => [...keys.users.all, 'managers'] as const,
  },
  org: {
    all: ['org'] as const,
    departments: () => [...keys.org.all, 'departments'] as const,
    whosOutToday: () => [...keys.org.all, 'whos-out', 'today'] as const,
  },
  rbac: {
    all: ['rbac'] as const,
    catalog: () => [...keys.rbac.all, 'catalog'] as const,
    roles: () => [...keys.rbac.all, 'roles'] as const,
    userPermissions: (userId: string) => [...keys.rbac.all, 'user-permissions', userId] as const,
  },
  admin: {
    all: ['admin'] as const,
    orgs: (params: AdminOrgsParams) => [...keys.admin.all, 'orgs', params] as const,
    plans: () => [...keys.admin.all, 'plans'] as const,
  },
  performance: {
    all: ['performance'] as const,
    goals: () => [...keys.performance.all, 'goals'] as const,
    reviews: (params: { month?: string }) => [...keys.performance.all, 'reviews', params] as const,
    insights: (userId: string) => [...keys.performance.all, 'insights', userId] as const,
  },
};

export const todayAttendanceQuery = () =>
  queryOptions({
    queryKey: keys.attendance.today(),
    queryFn: async (): Promise<AttendanceRecord[]> =>
      (await attendanceApi.getToday()).data.data ?? [],
  });

export interface MyTodayStatus {
  shift?: { name: string; start_time: string; end_time: string } | null;
  attendance?: {
    status: string;
    check_in_at?: string | null;
    check_out_at?: string | null;
    late_minutes?: number;
    net_hours_worked?: unknown;
    break_minutes?: number;
    break_records?: {
      break_type: string;
      break_start: string;
      break_end?: string | null;
      duration_mins?: number | null;
      is_paid?: boolean;
    }[];
  } | null;
  pre_checkin_late_minutes?: number;
}

export const myTodayStatusQuery = () =>
  queryOptions({
    queryKey: keys.attendance.myStatus(),
    queryFn: async (): Promise<MyTodayStatus | null> =>
      (await attendanceApi.getTodayStatus()).data.data ?? null,
  });

export const leaveRequestsQuery = (scope: 'all' | 'team') =>
  queryOptions({
    queryKey: keys.leave.requests(scope),
    queryFn: async (): Promise<LeaveRequest[]> => {
      const fn = scope === 'all' ? leaveApi.getAllRequests : leaveApi.getTeamRequests;
      return (await fn()).data.data ?? [];
    },
  });

// ─── Leave (server-side paginated, HR org-wide list) ──

export interface LeaveListParams {
  status?: string;
  q?: string;
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface LeaveListResult {
  requests: LeaveRequest[];
  pagination: { total: number; page: number; limit: number; pages?: number };
}

export const leaveRequestsListQuery = (params: LeaveListParams) =>
  queryOptions({
    queryKey: keys.leave.list(params),
    queryFn: async (): Promise<LeaveListResult> => {
      // Passing page/limit opts in to the { data, pagination } envelope
      const res = (await leaveApi.getAllRequests({
        status: params.status || undefined,
        q: params.q || undefined,
        page: params.page,
        limit: params.limit,
        sort: params.sort || undefined,
        order: params.order || undefined,
      })).data;
      return {
        requests: res.data ?? [],
        pagination: res.pagination ?? { total: (res.data ?? []).length, page: params.page, limit: params.limit },
      };
    },
  });

// Org-wide pending count for the header/tab — the paginated list only
// knows the total of the current filter, so this is fetched separately
// (limit 1: only the pagination envelope matters).
export const pendingLeaveCountQuery = () =>
  queryOptions({
    queryKey: keys.leave.pendingCount(),
    queryFn: async (): Promise<number> => {
      const res = (await leaveApi.getAllRequests({ status: 'pending', page: 1, limit: 1 })).data;
      return res.pagination?.total ?? (res.data ?? []).length;
    },
  });

export interface LeaveBalanceRow {
  leave_type: string;
  total_days: number;
  used_days: number;
  available_days: number;
}

export const myLeaveBalanceQuery = () =>
  queryOptions({
    queryKey: keys.leave.myBalance(),
    // Balance can 403 for roles without one — render nothing, no toast
    meta: { silent: true },
    queryFn: async (): Promise<LeaveBalanceRow[]> =>
      (await leaveApi.getMyBalance()).data.data ?? [],
  });

// ─── Expenses ─────────────────────────────────────────

export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'reimbursed';

export interface ExpenseClaim {
  id: string;
  /** Prisma Decimal — serialized as a string; render with Number(). */
  amount: string | number;
  currency: string;
  category: string;
  description: string;
  expense_date: string;
  receipt_url?: string | null;
  status: ExpenseStatus;
  review_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  user?: { id: string; name: string; avatar_url?: string; department?: string };
  reviewer?: { id: string; name: string } | null;
}

export const myExpensesQuery = () =>
  queryOptions({
    queryKey: keys.expenses.mine(),
    queryFn: async (): Promise<ExpenseClaim[]> =>
      (await expensesApi.getMine()).data.data ?? [],
  });

// ─── Documents ────────────────────────────────────────

export type DocumentCategory = 'contract' | 'id' | 'visa' | 'certificate' | 'other';

export interface EmployeeDocument {
  id: string;
  user_id: string;
  org_id: string;
  title: string;
  category: DocumentCategory | string;
  file_name: string;
  file_size: number;
  mime_type: string;
  expires_at: string | null;
  uploaded_by: string;
  created_at: string;
  owner?: { id: string; name: string; avatar_url?: string; department?: string };
  uploader?: { id: string; name: string };
}

export const myDocumentsQuery = () =>
  queryOptions({
    queryKey: keys.documents.mine(),
    queryFn: async (): Promise<EmployeeDocument[]> =>
      (await documentsApi.getMine()).data.data ?? [],
  });

// Requires documents.view_team — callers gate rendering on the permission.
export const userDocumentsQuery = (userId: string) =>
  queryOptions({
    queryKey: keys.documents.user(userId),
    enabled: !!userId,
    queryFn: async (): Promise<EmployeeDocument[]> =>
      (await documentsApi.getForUser(userId)).data.data ?? [],
  });

// ─── Announcements ────────────────────────────────────

export interface Announcement {
  id: string;
  org_id: string;
  title: string;
  body: string;
  department_id: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  my_read_at?: string | null;
  author?: { id: string; name: string; avatar_url?: string };
}

// Published announcements targeted at the caller (org-wide + own department)
export const announcementsQuery = () =>
  queryOptions({
    queryKey: keys.announcements.list(),
    queryFn: async (): Promise<Announcement[]> =>
      (await announcementsApi.getAll()).data.data ?? [],
  });

export interface AnnouncementReceipts {
  read_count: number;
  audience_count: number;
  readers: { id: string; name: string; avatar_url?: string; department?: string; read_at: string }[];
}

// Requires org.announcements.send
export const announcementReceiptsQuery = (id: string) =>
  queryOptions({
    queryKey: keys.announcements.receipts(id),
    enabled: !!id,
    queryFn: async (): Promise<AnnouncementReceipts | null> =>
      (await announcementsApi.getReceipts(id)).data.data ?? null,
  });

// ─── Overtime ─────────────────────────────────────────

export interface OvertimeRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_minutes: number;
  reason?: string;
  rejection_reason?: string;
  created_at: string;
  user?: { id: string; name: string; department?: string; avatar_url?: string };
  attendance?: { date: string; shift?: { name: string } };
}

export interface OvertimeSummaryRow {
  user_id: string;
  name: string;
  department?: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  regular_pay: number;
  overtime_pay: number;
}

export interface OvertimeRule {
  id: string;
  name: string;
  rule_type: 'daily' | 'weekly' | 'seventh_day';
  threshold_hours: number;
  multiplier: number;
  priority: number;
  is_active: boolean;
}

export const myOvertimeRequestsQuery = () =>
  queryOptions({
    queryKey: keys.overtime.myRequests(),
    queryFn: async (): Promise<OvertimeRequest[]> =>
      (await overtimeApi.getMyRequests()).data.data ?? [],
  });

export const pendingOvertimeRequestsQuery = () =>
  queryOptions({
    queryKey: keys.overtime.pending(),
    queryFn: async (): Promise<OvertimeRequest[]> =>
      (await overtimeApi.getRequests({ status: 'pending' })).data.data ?? [],
  });

export const overtimeSummaryQuery = () =>
  queryOptions({
    queryKey: keys.overtime.summary(),
    queryFn: async (): Promise<OvertimeSummaryRow[]> =>
      (await overtimeApi.getSummary()).data.data ?? [],
  });

export const overtimeRulesQuery = () =>
  queryOptions({
    queryKey: keys.overtime.rules(),
    queryFn: async (): Promise<OvertimeRule[]> =>
      (await overtimeApi.getRules()).data.data ?? [],
  });

// ─── Remote ───────────────────────────────────────────

export interface RemoteNudgeLog {
  id: string;
  nudge_type: 'morning' | 'midday' | 'end_of_day';
  nudge_sent_at: string;
  reply_text: string | null;
  reply_at: string | null;
  task_summary: string | null;
  blockers: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  no_reply_alerted: boolean;
}

export interface RemoteSession {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  duration_type: string;
  created_at?: string;
  morning_nudge_at: string | null;
  midday_nudge_at: string | null;
  end_nudge_at: string | null;
  ai_summary: string | null;
  is_online: boolean;
  last_seen: string | null;
  responded_count: number;
  no_reply_count: number;
  latest_sentiment: 'positive' | 'neutral' | 'negative' | null;
  latest_task_summary: string | null;
  user?: { id: string; name: string; department?: string; avatar_url?: string };
  attendance?: { date: string };
  checkin_logs: RemoteNudgeLog[];
}

export interface RemoteMonitorData {
  date: string;
  stats: { total: number; responded: number; no_reply: number; avg_sentiment: string | null };
  sessions: RemoteSession[];
}

export const remoteMonitorQuery = () =>
  queryOptions({
    queryKey: keys.remote.monitor(),
    queryFn: async (): Promise<RemoteMonitorData | null> =>
      (await remoteApi.getMonitor()).data.data ?? null,
  });

export const pendingRemoteSessionsQuery = () =>
  queryOptions({
    queryKey: keys.remote.pendingSessions(),
    queryFn: async (): Promise<RemoteSession[]> =>
      (await remoteApi.getSessions({ status: 'pending' })).data.data ?? [],
  });

// ─── Shift swaps ──────────────────────────────────────

export const swapRequestsQuery = () =>
  queryOptions({
    queryKey: keys.swaps.list(),
    queryFn: async (): Promise<SwapRequest[]> =>
      (await shiftsApi.getSwapRequests()).data.data ?? [],
  });

// ─── Users (server-side paginated) ────────────────────

export interface UsersListParams {
  page: number;
  limit: number;
  q?: string;
  department?: string;
  role?: string;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface UsersListResult {
  users: User[];
  pagination: { total: number; page: number; limit: number; pages?: number };
}

export const usersListQuery = (params: UsersListParams) =>
  queryOptions({
    queryKey: keys.users.list(params),
    queryFn: async (): Promise<UsersListResult> => {
      // GET /users returns a paginated envelope:
      // { success, data: User[], pagination: { page, limit, total, pages } }
      const res = (await usersApi.getAll({
        page: params.page,
        limit: params.limit,
        q: params.q || undefined,
        department: params.department || undefined,
        role: params.role || undefined,
        status: params.status || undefined,
        sort: params.sort || undefined,
        order: params.order || undefined,
      })).data;
      return {
        users: res.data ?? [],
        pagination: res.pagination ?? { total: (res.data ?? []).length, page: params.page, limit: params.limit },
      };
    },
  });

// Managers/HR admins for the "Reporting Manager" dropdown — fetched
// separately because the paginated list no longer holds the whole org.
export const managersQuery = () =>
  queryOptions({
    queryKey: keys.users.managers(),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<User[]> => {
      const [mgrs, admins] = await Promise.all([
        usersApi.getAll({ role: 'manager', limit: 100 }),
        usersApi.getAll({ role: 'hr_admin', limit: 100 }),
      ]);
      return [...(mgrs.data.data ?? []), ...(admins.data.data ?? [])];
    },
  });

export const departmentsQuery = () =>
  queryOptions({
    queryKey: keys.org.departments(),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> =>
      (await orgApi.getDepartments()).data.data ?? [],
  });

// ─── Who's out (today) ────────────────────────────────

export interface WhosOutUser {
  id: string;
  name: string;
  avatar_url?: string;
  department?: string;
}

export interface WhosOutLeaveEntry {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  is_half_day?: boolean;
  half_day_period?: string | null;
  user: WhosOutUser;
}

export interface WhosOutRemoteEntry {
  id: string;
  user: WhosOutUser;
  date: string | null;
}

export interface WhosOutData {
  from: string;
  to: string;
  on_leave: WhosOutLeaveEntry[];
  remote: WhosOutRemoteEntry[];
  holidays: string[];
}

export const whosOutTodayQuery = () =>
  queryOptions({
    queryKey: keys.org.whosOutToday(),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<WhosOutData | null> => {
      // "Today" in the ORG timezone (matches how attendance dates are keyed).
      const today = formatDate(new Date(), 'yyyy-MM-dd');
      return (await orgApi.getWhosOut({ from: today, to: today })).data.data ?? null;
    },
  });

export const orgSettingsQuery = () =>
  queryOptions({
    queryKey: keys.org.all,
    queryFn: async () => (await orgApi.getSettings()).data.data,
  });

export const whatsappSettingsQuery = () =>
  queryOptions({
    queryKey: [...keys.org.all, 'whatsapp'],
    queryFn: async () => (await orgApi.getWhatsAppSettings()).data.data,
  });

// ─── RBAC ─────────────────────────────────────────────

export interface OrgRoleRecord {
  id: string;
  name: string;
  slug: string;
  is_system: boolean;
  permission_keys: string[];
  user_count: number;
  created_at: string;
}

export interface PermissionDef {
  key: string;
  module: string;
  description: string;
}

export interface UserPermissionGrant {
  permission_key: string;
  effect: 'allow' | 'deny';
}

export const permissionCatalogQuery = () =>
  queryOptions({
    queryKey: keys.rbac.catalog(),
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<PermissionDef[]> =>
      (await orgRbacApi.getPermissionCatalog()).data.data ?? [],
  });

export const orgRolesQuery = () =>
  queryOptions({
    queryKey: keys.rbac.roles(),
    queryFn: async (): Promise<OrgRoleRecord[]> =>
      (await orgRbacApi.getRoles()).data.data ?? [],
  });

export const userPermissionsQuery = (userId: string) =>
  queryOptions({
    queryKey: keys.rbac.userPermissions(userId),
    enabled: !!userId,
    queryFn: async (): Promise<UserPermissionGrant[]> =>
      (await usersApi.getPermissions(userId)).data.data ?? [],
  });

// ─── Admin (platform) ─────────────────────────────────

export interface AdminOrgsParams {
  q?: string;
  status?: string;
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface AdminOrgsResult {
  orgs: AdminOrg[];
  pagination: { total: number; page: number; limit: number; pages?: number };
}

export const adminOrgsQuery = (params: AdminOrgsParams) =>
  queryOptions({
    queryKey: keys.admin.orgs(params),
    queryFn: async (): Promise<AdminOrgsResult> => {
      // Passing page/limit opts in to the { data, pagination } envelope
      const res = (await adminApi.getOrgs({
        q: params.q || undefined,
        status: params.status || undefined,
        page: params.page,
        limit: params.limit,
        sort: params.sort || undefined,
        order: params.order || undefined,
      })).data;
      return {
        orgs: res.data ?? [],
        pagination: res.pagination ?? { total: (res.data ?? []).length, page: params.page, limit: params.limit },
      };
    },
  });

export const adminPlansQuery = () =>
  queryOptions({
    queryKey: keys.admin.plans(),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PlanDefinition[]> =>
      (await adminApi.getPlans()).data.data ?? [],
  });

// ─── Performance ──────────────────────────────────────

export const performanceGoalsQuery = () =>
  queryOptions({
    queryKey: keys.performance.goals(),
    queryFn: async (): Promise<PerformanceGoal[]> =>
      (await performanceApi.getGoals()).data.data ?? [],
  });

export const performanceReviewsQuery = (params: { month?: string }) =>
  queryOptions({
    queryKey: keys.performance.reviews(params),
    queryFn: async (): Promise<PerformanceReview[]> =>
      (await performanceApi.getReviews(params)).data.data ?? [],
  });

export const performanceInsightsQuery = (userId: string) =>
  queryOptions({
    queryKey: keys.performance.insights(userId),
    enabled: !!userId,
    queryFn: async (): Promise<string> =>
      (await performanceApi.getInsights(userId)).data.data?.insights ?? '',
  });
