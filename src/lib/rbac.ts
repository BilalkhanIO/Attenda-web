/**
 * Client-side legacy role → permission fallback (mirrors attenda-api/src/constants/rbac.ts).
 * Used only when capabilities have not loaded yet or a key is missing from the API set.
 */
const MANAGER_PERMS = [
  'employees.view_team',
  'attendance.view_team',
  'attendance.override',
  'attendance.late_notices.manage',
  'leave.view_team',
  'leave.approve',
  'shifts.view',
  'shifts.breaks.manage',
  'shifts.swaps.approve',
  'performance.view',
  'performance.manage',
  'analytics.view',
  'remote.approve',
] as const;

const HR_ADMIN_PERMS = [
  ...MANAGER_PERMS,
  'employees.view',
  'employees.create',
  'employees.update',
  'employees.deactivate',
  'employees.import',
  'attendance.export',
  'leave.view_all',
  'leave.balance.manage',
  'shifts.manage',
  'shifts.assign',
  'shifts.ai_schedule',
  'payroll.view',
  'payroll.manage',
  'payroll.process',
  'reports.view',
  'reports.export',
  'analytics.advanced',
  'overtime.manage',
  'whatsapp.test',
  'whatsapp.logs.view',
  'org.settings.view',
  'org.qr.manage',
] as const;

const SUPER_ADMIN_PERMS = [
  ...HR_ADMIN_PERMS,
  'org.settings.update',
  'org.office.update',
  'org.whatsapp.update',
  'org.roles.manage',
  'org.permissions.grant',
  'employees.credentials.update',
] as const;

export const LEGACY_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  employee: [],
  manager: MANAGER_PERMS,
  hr_admin: HR_ADMIN_PERMS,
  super_admin: SUPER_ADMIN_PERMS,
};

export function legacyRoleHasPermission(role: string, permissionKey: string): boolean {
  const perms = LEGACY_ROLE_PERMISSIONS[role];
  return perms?.includes(permissionKey) ?? false;
}
