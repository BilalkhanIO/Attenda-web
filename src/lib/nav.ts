/** Feature/permission visibility rule for sidebar nav items. */
export interface NavVisibilityItem {
  /** Org feature flag that must be enabled (missing = always on). */
  feature?: string;
  /** Primary permission key. */
  permission?: string;
  /** Alternative permission keys — any one grants visibility. */
  permissionsAlt?: string[];
}

export function navItemVisible(
  item: NavVisibilityItem,
  hasFeature: (key: string) => boolean,
  hasPermission: (key: string) => boolean,
): boolean {
  if (item.feature && !hasFeature(item.feature)) return false;
  if (item.permission) {
    const permKeys = [item.permission, ...(item.permissionsAlt ?? [])];
    return permKeys.some(k => hasPermission(k));
  }
  return true;
}
