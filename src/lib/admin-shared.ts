import { formatDate, LOCAL_TZ } from '@/lib/i18n';
import type { PlanFeatures } from '@/types';

export interface PlatformStats {
  org_count: number;
  user_count: number;
  active_today: number;
  pending_count: number;
  trialing_count?: number;
  inactive_count?: number;
}

export interface OrgOnboarding {
  profile_set: boolean;
  ips_set: boolean;
  wa_enabled: boolean;
}

export interface AdminOrg {
  id: string;
  name: string;
  plan: string;
  status: string;
  subscription_status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  seats_limit: number | null;
  features_override: Partial<PlanFeatures> | null;
  admin_notes: string | null;
  billing_email: string | null;
  timezone: string;
  created_at: string;
  user_count: number;
  onboarding: OrgOnboarding;
  onboarding_score: number;
  contact_name?: string;
  contact_email?: string;
  company_size?: string;
  record_counts?: {
    attendance: number;
    leave: number;
    payroll: number;
  };
}

export interface AdminOrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  job_title?: string;
  is_active: boolean;
  created_at: string;
}

export const PLAN_STYLES: Record<string, { color: string; bg: string }> = {
  trial:      { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
  starter:    { color: '#00C896', bg: 'rgba(0, 200, 150, 0.1)' },
  growth:     { color: '#00E5FF', bg: 'rgba(0, 229, 255, 0.1)' },
  business:   { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  enterprise: { color: '#f8fafc', bg: 'rgba(248, 250, 252, 0.1)' },
  suspended:  { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' },
};

export const ORG_STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  active:    { color: '#00C896', bg: 'rgba(0, 200, 150, 0.1)', label: 'Active' },
  pending:   { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', label: 'Pending' },
  suspended: { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)', label: 'Suspended' },
  rejected:  { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', label: 'Rejected' },
};

export const SUB_STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  trialing:  { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', label: 'Trialing' },
  active:    { color: '#00C896', bg: 'rgba(0, 200, 150, 0.1)', label: 'Active' },
  inactive:  { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', label: 'Inactive' },
  suspended: { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)', label: 'Suspended' },
  defaulted: { color: '#fb7185', bg: 'rgba(251, 113, 133, 0.1)', label: 'Defaulted' },
};

export const ROLE_STYLES: Record<string, { color: string; bg: string }> = {
  super_admin:    { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' },
  hr_admin:       { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  manager:        { color: '#00C896', bg: 'rgba(0, 200, 150, 0.1)' },
  employee:       { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
  platform_admin: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
};

export const FEATURE_LABELS: Record<string, string> = {
  attendance:          'Attendance',
  leave_management:    'Leave Management',
  shifts:              'Shifts',
  payroll:             'Payroll',
  whatsapp:            'WhatsApp',
  performance_reviews: 'Performance Reviews',
  remote_work:         'Remote Work',
  api_access:          'API Access',
  advanced_reports:    'Advanced Reports',
  multi_location:      'Multi-Location',
};

export const ALL_FEATURE_KEYS = Object.keys(FEATURE_LABELS);

export function fmtDate(d: string | null) {
  if (!d) return '—';
  // Style-pinned day-first render ("2 Aug 2026") in the viewer's timezone.
  return formatDate(d, { day: 'numeric', month: 'short', year: 'numeric', locale: 'en-GB', timeZone: LOCAL_TZ });
}

/** Full timestamp with seconds ("8/2/2026, 5:04:56 PM") for admin logs. */
export function fmtDateTime(d: string | Date) {
  return formatDate(d, {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    timeZone: LOCAL_TZ,
  });
}

export function daysLeft(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export type FeatureOverrideState = 'inherit' | 'on' | 'off';

export function featureOverrideState(
  key: string,
  planFeatures: PlanFeatures | null | undefined,
  overrides: Partial<PlanFeatures> | null | undefined,
): FeatureOverrideState {
  if (overrides && key in overrides) {
    return overrides[key] ? 'on' : 'off';
  }
  if (planFeatures && planFeatures[key]) return 'on';
  return 'inherit';
}

export function buildFeaturesOverride(
  states: Record<string, FeatureOverrideState>,
): Partial<PlanFeatures> | null {
  const out: Partial<PlanFeatures> = {};
  for (const [key, state] of Object.entries(states)) {
    if (state === 'on') out[key] = true;
    if (state === 'off') out[key] = false;
  }
  return Object.keys(out).length > 0 ? out : null;
}
