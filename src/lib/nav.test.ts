import { describe, it, expect } from 'vitest';
import { navItemVisible } from './nav';

const featureOn = () => true;
const featureOff = () => false;
const grantAll = () => true;
const grantNone = () => false;
const grantOnly = (...keys: string[]) => (k: string) => keys.includes(k);

describe('navItemVisible', () => {
  it('shows unrestricted items to everyone', () => {
    expect(navItemVisible({}, featureOff, grantNone)).toBe(true);
  });

  it('hides items whose org feature is disabled, regardless of permissions', () => {
    expect(navItemVisible({ feature: 'payroll', permission: 'payroll.view' }, featureOff, grantAll)).toBe(false);
    expect(navItemVisible({ feature: 'payroll' }, featureOff, grantAll)).toBe(false);
  });

  it('requires the permission when one is declared', () => {
    const item = { feature: 'payroll', permission: 'payroll.view' };
    expect(navItemVisible(item, featureOn, grantOnly('payroll.view'))).toBe(true);
    expect(navItemVisible(item, featureOn, grantNone)).toBe(false);
  });

  it('accepts any alternative permission', () => {
    const item = {
      permission: 'employees.view',
      permissionsAlt: ['employees.view_team'],
    };
    expect(navItemVisible(item, featureOn, grantOnly('employees.view'))).toBe(true);
    expect(navItemVisible(item, featureOn, grantOnly('employees.view_team'))).toBe(true);
    expect(navItemVisible(item, featureOn, grantOnly('something.else'))).toBe(false);
  });

  it('feature-only items just need the feature', () => {
    expect(navItemVisible({ feature: 'leave_management' }, featureOn, grantNone)).toBe(true);
  });
});
