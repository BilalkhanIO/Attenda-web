import { queryOptions } from '@tanstack/react-query';
import { attendanceApi, leaveApi } from './api';
import type { AttendanceRecord, LeaveRequest } from '@/types';

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
