import { queryOptions } from '@tanstack/react-query';
import {
  attendanceApi, leaveApi, overtimeApi, remoteApi, shiftsApi,
  usersApi, orgApi, performanceApi
} from './api';
import type {
  AttendanceRecord, LeaveRequest, SwapRequest, User,
  PerformanceGoal, PerformanceReview
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
    myBalance: () => [...keys.leave.all, 'balance', 'me'] as const,
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
  search?: string;
  department?: string;
  role?: string;
  status?: string;
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
        search: params.search || undefined,
        department: params.department || undefined,
        role: params.role || undefined,
        status: params.status || undefined,
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
