import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  formatDate as intlFormatDate,
  formatTime as intlFormatTime,
  formatDateTime as intlFormatDateTime,
  formatDateOnly as intlFormatDateOnly,
  formatCurrency as intlFormatCurrency,
  formatRelative,
  getDisplayTimezone,
  toISODate,
} from './i18n';
import type { Role, AttendanceStatus, LeaveStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date / Time ──────────────────────────────────────
// All formatting is Intl-backed and centralized in ./i18n (locale +
// org display timezone + org currency live there); these wrappers keep
// the legacy date-fns-style signatures so call sites don't churn.
export { setDisplayTimezone, getDisplayTimezone } from './i18n';

const DEFAULT_DATE_FMT = 'MMM d, yyyy';

function toInstant(date: string | Date): Date {
  return typeof date === 'string' ? parseISO(date) : date;
}

/** Format a real timestamp (e.g. check_in_at) in the org timezone. */
export function formatDate(date: string | Date, fmt = DEFAULT_DATE_FMT, tz: string = getDisplayTimezone()) {
  if (fmt === DEFAULT_DATE_FMT) return intlFormatDate(date, { timeZone: tz });
  if (fmt === 'yyyy-MM-dd') return toISODate(date, tz);
  // Legacy escape hatch for other date-fns patterns (none in-tree —
  // prefer i18n.formatDate with Intl options).
  return formatInTimeZone(toInstant(date), tz, fmt);
}

export function formatTime(date: string | Date, tz: string = getDisplayTimezone()) {
  return intlFormatTime(date, { timeZone: tz });
}

export function formatDateTime(date: string | Date, tz: string = getDisplayTimezone()) {
  return intlFormatDateTime(date, { timeZone: tz });
}

/**
 * Format a calendar-date-only value (a @db.Date field such as attendance.date,
 * stored as UTC-midnight carrying the org-local Y-M-D). Rendered in UTC so the
 * day never shifts in timezones behind UTC.
 */
export function formatDateOnly(date: string | Date, fmt = DEFAULT_DATE_FMT) {
  if (fmt === DEFAULT_DATE_FMT) return intlFormatDateOnly(date);
  return formatInTimeZone(toInstant(date), 'UTC', fmt);
}

export function timeAgo(date: string | Date) {
  // Relative ("3 hours ago") — a duration between two instants, timezone-agnostic.
  return formatRelative(date);
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
export function formatCurrency(amount: number, currency?: string) {
  return intlFormatCurrency(amount, currency);
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

// ─── Effect-safe loader invocation ────────────────────
/**
 * Kick off a state-setting loader from inside a `useEffect` without
 * setting state synchronously during the effect flush
 * (react-hooks/set-state-in-effect): the task is deferred to a
 * microtask, which is imperceptible next to the network round-trip the
 * loader performs. Returns a canceller suitable as the effect cleanup,
 * so a re-run scheduled by an already-stale effect never fires.
 *
 *   useEffect(() => runDeferred(load), [load]);
 */
export function runDeferred(task: () => unknown): () => void {
  let cancelled = false;
  void Promise.resolve().then(() => { if (!cancelled) task(); });
  return () => { cancelled = true; };
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
