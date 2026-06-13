// ─── Core response wrapper ─────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  pagination?: { page: number; limit: number; total: number; pages: number };
}

// ─── Users ────────────────────────────────────────────
export type Role = 'super_admin' | 'hr_admin' | 'manager' | 'employee';
/** JWT / auth role (tenant roles + platform_admin) */
export type AuthRole = Role | 'platform_admin';
export type UserStatus = 'active' | 'inactive';

export interface OrgRoleSummary {
  id: string;
  slug: string;
  name: string;
}

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
export type AttendanceStatus = 'in' | 'out' | 'late' | 'absent' | 'leave' | 'half_leave' | 'remote';
export type CheckInType = 'auto_ip' | 'qr' | 'manual' | 'remote';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  user?: Pick<User, 'id' | 'name' | 'avatar_url' | 'department' | 'job_title'>;
  date: string;
  check_in_at?: string;
  check_out_at?: string;
  status: AttendanceStatus;
  check_in_type: CheckInType;
  type?: CheckInType;          // legacy alias — prefer check_in_type
  hours_worked?: number;
  net_hours_worked?: number;
  overtime_hours?: number;
  extra_office_minutes?: number;
  shift_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  ip_detected?: string;
  late_minutes?: number;
  early_out_minutes?: number;
  early_checkin_minutes?: number;
  adherence_score?: number;
  auto_checked_out?: boolean;
  break_minutes?: number;
  paid_break_minutes?: number;
  is_overridden: boolean;
  override_reason?: string;
  late_notice_id?: string;
  is_on_approved_leave?: boolean;
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
  is_half_day?: boolean;
  half_day_period?: 'morning' | 'afternoon';
  leave_start_time?: string;
  leave_end_time?: string;
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
  active_days: number[];
  overtime_multiplier?: number;
  min_rest_hours?: number;
  late_tolerance_mins?: number;
  early_checkout_tolerance_mins?: number;
  auto_checkout?: boolean;
  auto_checkout_buffer_mins?: number;
  overtime_enabled?: boolean;
  overtime_requires_approval?: boolean;
  extra_time_label?: string;
  is_org_wide?: boolean;
  is_default?: boolean;
  is_published?: boolean;
  breaks?: ShiftBreak[];
}

export interface ShiftBreak {
  id: string;
  name: string;
  break_kind: 'fixed' | 'flexible';
  break_minutes: number;
  is_paid: boolean;
  after_minutes: number;
  break_start_time?: string;
  break_end_time?: string;
  allowed_count_per_shift: number;
  paid_within_limit: boolean;
  deduct_extra_time: boolean;
  allow_extra_breaks: boolean;
  applies_days: number[];
  exception_dates: string[];
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
  hours_worked: number;
  unpaid_days: number;
  hourly_rate: number;
  gross_pay: number;
  tax: number;
  pension: number;
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
export type GoalStatus = 'active' | 'completed' | 'cancelled' | string;

export interface PerformanceGoal {
  id: string;
  user_id: string;
  review_id?: string;
  title: string;
  description?: string;
  weight: number;
  target_date?: string;
  due_date?: string;
  completion: number;
  progress?: number;
  status?: GoalStatus;
  user?: { id: string; name: string; department?: string; avatar_url?: string };
}

export interface PerformanceReview {
  id: string;
  user_id: string;
  user?: { id: string; name: string; department?: string; avatar_url?: string };
  reviewer_id?: string;
  reviewer?: { id: string; name: string };
  score: number;
  comments: string;
  month: string;
  submitted_at: string | null;
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


// ─── Notifications ────────────────────────────────────
export interface InAppNotification {
  id:          string;
  user_id:     string;
  org_id:      string;
  type:        string;
  title:       string;
  body:        string;
  action_type: string | null;
  action_id:   string | null;
  metadata:    Record<string, unknown> | null;
  read_at:     string | null;
  created_at:  string;
}

export interface NotificationList {
  items:        InAppNotification[];
  total:        number;
  page:         number;
  limit:        number;
  unread_count: number;
}

// ─── SaaS / Subscription ─────────────────────────────
export type SubscriptionStatus = 'trialing' | 'active' | 'inactive' | 'suspended' | 'defaulted';

export interface PlanFeatures {
  attendance: boolean;
  leave_management: boolean;
  shifts: boolean;
  payroll: boolean;
  whatsapp: boolean;
  performance_reviews: boolean;
  remote_work: boolean;
  api_access: boolean;
  advanced_reports: boolean;
  multi_location: boolean;
  [key: string]: boolean;
}

/** GET /users/me/capabilities */
export interface UserCapabilities {
  permissions: string[];
  features: PlanFeatures;
  org_role: OrgRoleSummary | null;
  platform_permissions: string[];
  /** Org IANA timezone — all wall-clock times are rendered in this zone. */
  timezone?: string;
}

export interface PermissionDef {
  key: string;
  module: string;
  description: string;
}

export interface OrgRoleRecord {
  id: string;
  name: string;
  slug: string;
  is_system: boolean;
  permission_keys: string[];
  user_count: number;
  created_at: string;
}

export interface UserPermissionGrant {
  permission_key: string;
  effect: 'allow' | 'deny';
}

export interface PlanDefinition {
  id: string;
  display_name: string;
  price_monthly: number;
  price_annual: number;
  max_employees: number;
  trial_days: number;
  features: PlanFeatures;
  description: string | null;
  highlight: boolean;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}

export interface OrgSubscription {
  id: string;
  name: string;
  plan: string;
  status: string;
  subscription_status: SubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  seats_limit: number | null;
  features_override: Partial<PlanFeatures> | null;
  admin_notes: string | null;
  billing_email: string | null;
}

// ─── Blog ─────────────────────────────────────────────
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  author_name: string;
  author_avatar: string | null;
  cover_image: string | null;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  is_published: boolean;
  published_at: string | null;
  read_time_mins: number | null;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface BlogListItem extends Omit<BlogPost, 'content'> {}

export interface BlogListResponse {
  posts: BlogListItem[];
  total: number;
  page: number;
  pages: number;
}
