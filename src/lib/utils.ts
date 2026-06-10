import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { Role, AttendanceStatus, LeaveStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date / Time ──────────────────────────────────────
// All wall-clock display uses the ORGANISATION's timezone, so an employee's
// 9:00 AM check-in reads as 9:00 AM for every viewer regardless of their own
// browser timezone. `_displayTz` is set once after login (AuthProvider →
// setDisplayTimezone) from the org settings; until then we fall back to the
// browser timezone so the first paint isn't UTC.
let _displayTz: string = (typeof Intl !== 'undefined'
  && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';

export function setDisplayTimezone(tz?: string | null) {
  if (tz) _displayTz = tz;
}
export function getDisplayTimezone() {
  return _displayTz;
}

function toInstant(date: string | Date): Date {
  return typeof date === 'string' ? parseISO(date) : date;
}

/** Format a real timestamp (e.g. check_in_at) in the org timezone. */
export function formatDate(date: string | Date, fmt = 'MMM d, yyyy', tz: string = _displayTz) {
  return formatInTimeZone(toInstant(date), tz, fmt);
}

export function formatTime(date: string | Date, tz: string = _displayTz) {
  return formatInTimeZone(toInstant(date), tz, 'hh:mm a');
}

export function formatDateTime(date: string | Date, tz: string = _displayTz) {
  return formatInTimeZone(toInstant(date), tz, 'MMM d, yyyy hh:mm a');
}

/**
 * Format a calendar-date-only value (a @db.Date field such as attendance.date,
 * stored as UTC-midnight carrying the org-local Y-M-D). Rendered in UTC so the
 * day never shifts in timezones behind UTC.
 */
export function formatDateOnly(date: string | Date, fmt = 'MMM d, yyyy') {
  return formatInTimeZone(toInstant(date), 'UTC', fmt);
}

export function timeAgo(date: string | Date) {
  // Relative ("3 hours ago") — a duration between two instants, timezone-agnostic.
  return formatDistanceToNow(toInstant(date), { addSuffix: true });
}

// ─── Status helpers ───────────────────────────────────
export const statusConfig: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  in:     { label: 'Checked In',  color: 'var(--success-700)', bg: 'var(--success-100)' },
  out:    { label: 'Checked Out', color: 'var(--gray-500)',    bg: 'var(--gray-100)'    },
  late:   { label: 'Late',        color: 'var(--warning-800)', bg: 'var(--warning-100)' },
  absent: { label: 'Absent',      color: 'var(--danger-800)',  bg: 'var(--danger-100)'  },
  leave:      { label: 'On Leave',      color: 'var(--primary-600)', bg: 'var(--primary-100)' },
  half_leave: { label: 'Half-Day Leave', color: 'var(--teal-700)',   bg: 'var(--teal-100)'    },
  remote:     { label: 'Remote',         color: 'var(--purple-700)', bg: 'var(--purple-100)'  },
};

export const leaveStatusConfig: Record<LeaveStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: 'var(--warning-800)', bg: 'var(--warning-100)' },
  approved:  { label: 'Approved',  color: 'var(--success-700)', bg: 'var(--success-100)' },
  rejected:  { label: 'Rejected',  color: 'var(--danger-800)',  bg: 'var(--danger-100)'  },
  cancelled: { label: 'Cancelled', color: 'var(--gray-500)',    bg: 'var(--gray-100)'    },
};

export const roleLabels: Record<Role, string> = {
  super_admin: 'Super Admin',
  hr_admin:    'HR Admin',
  manager:     'Manager',
  employee:    'Employee',
};

// ─── Number helpers ───────────────────────────────────
export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatHours(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Avatar initials ──────────────────────────────────
export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── API error message ────────────────────────────────
export function getApiError(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const err = error as { response?: { data?: { error?: string; message?: string } } };
    return err.response?.data?.error || err.response?.data?.message || 'Something went wrong';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
