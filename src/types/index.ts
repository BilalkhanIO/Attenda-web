// ─── Core response wrapper ─────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  pagination?: { page: number; limit: number; total: number; pages: number };
}

// ─── Users ────────────────────────────────────────────
export type Role = 'super_admin' | 'hr_admin' | 'manager' | 'employee';
export type UserStatus = 'active' | 'inactive';

export interface User {
  id: string;
  org_id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  job_title: string;
  phone?: string;
  avatar_url?: string;
  manager_id?: string;
  manager?: Pick<User, 'id' | 'name'>;
  hourly_rate?: number;
  status: UserStatus;
  created_at: string;
}

// ─── Attendance ───────────────────────────────────────
export type AttendanceStatus = 'in' | 'out' | 'late' | 'absent' | 'leave' | 'remote';
export type CheckInType = 'auto_ip' | 'qr' | 'manual' | 'remote';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  user?: Pick<User, 'id' | 'name' | 'avatar_url' | 'department' | 'job_title'>;
  date: string;
  check_in_at?: string;
  check_out_at?: string;
  status: AttendanceStatus;
  type: CheckInType;
  hours_worked?: number;
  shift_id?: string;
  is_overridden: boolean;
  override_reason?: string;
  created_at: string;
}

export interface LiveAttendance {
  user: User;
  status: AttendanceStatus;
  check_in_at?: string;
  check_out_at?: string;
  shift_start?: string;
  minutes_late?: number;
}

// ─── Leave ────────────────────────────────────────────
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveType {
  id: string;
  name: string;
  is_paid: boolean;
  default_days: number;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  user?: Pick<User, 'id' | 'name' | 'avatar_url' | 'department'>;
  leave_type_id: string;
  leave_type?: LeaveType;
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string;
  status: LeaveStatus;
  approved_by?: string;
  approver?: Pick<User, 'id' | 'name'>;
  rejection_reason?: string;
  created_at: string;
}

export interface LeaveBalance {
  leave_type: LeaveType;
  entitled_days: number;
  used_days: number;
  remaining_days: number;
}

// ─── Shifts ───────────────────────────────────────────
export interface Shift {
  id: string;
  org_id: string;
  name: string;
  start_time: string;
  end_time: string;
  color: string;
  days_of_week: number[];
}

export interface ShiftAssignment {
  id: string;
  user_id: string;
  user?: Pick<User, 'id' | 'name' | 'avatar_url' | 'department'>;
  shift_id: string;
  shift?: Shift;
  date: string;
}

export interface SwapRequest {
  id: string;
  requester: Pick<User, 'id' | 'name'>;
  target: Pick<User, 'id' | 'name'>;
  requester_assignment: ShiftAssignment;
  target_assignment: ShiftAssignment;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  created_at: string;
}

// ─── Payroll ──────────────────────────────────────────
export type PayrollStatus = 'draft' | 'reviewing' | 'processed';

export interface PayrollRecord {
  id: string;
  user_id: string;
  user?: Pick<User, 'id' | 'name' | 'department' | 'job_title'>;
  payroll_id: string;
  regular_hours: number;
  overtime_hours: number;
  unpaid_days: number;
  hourly_rate: number;
  gross_pay: number;
  adjustments: number;
  net_pay: number;
  is_incomplete: boolean;
}

export interface Payroll {
  id: string;
  org_id: string;
  month: number;
  year: number;
  status: PayrollStatus;
  total_gross: number;
  total_employees: number;
  processed_at?: string;
  records: PayrollRecord[];
}

// ─── Performance ──────────────────────────────────────
export type GoalStatus = 'active' | 'completed' | 'cancelled';

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string;
  due_date: string;
  status: GoalStatus;
  progress: number;
}

export interface PerformanceReview {
  id: string;
  user_id: string;
  user?: Pick<User, 'id' | 'name' | 'department'>;
  reviewer_id: string;
  reviewer?: Pick<User, 'id' | 'name'>;
  score: number;
  comments: string;
  month: string;
  submitted_at: string;
}

// ─── Analytics ────────────────────────────────────────
export interface AnalyticsOverview {
  checked_in: number;
  checked_out: number;
  remote: number;
  on_leave: number;
  absent: number;
  total_employees: number;
  updated_at: string;
}

export interface AttendanceTrendPoint {
  date: string;
  present: number;
  absent: number;
  late: number;
  rate: number;
}
