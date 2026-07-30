import { describe, it, expect } from 'vitest';
import { decideRoute } from './proxy';

describe('decideRoute', () => {
  it('lets anonymous visitors through public paths', () => {
    for (const path of ['/', '/about', '/login', '/blog/some-post', '/reset-password']) {
      expect(decideRoute(path, false, null)).toEqual({ action: 'next' });
    }
  });

  it('sends authenticated users away from /login and /get-started', () => {
    expect(decideRoute('/login', true, 'employee')).toEqual({ action: 'redirect', to: '/dashboard' });
    expect(decideRoute('/get-started', true, 'hr_admin')).toEqual({ action: 'redirect', to: '/dashboard' });
    expect(decideRoute('/login', true, 'platform_admin')).toEqual({ action: 'redirect', to: '/admin' });
  });

  it('leaves authenticated users alone on other public paths', () => {
    expect(decideRoute('/about', true, 'employee')).toEqual({ action: 'next' });
    expect(decideRoute('/blog/post', true, 'platform_admin')).toEqual({ action: 'next' });
  });

  it('redirects anonymous visitors on protected paths to login with a redirect param', () => {
    expect(decideRoute('/dashboard', false, null)).toEqual({
      action: 'redirect',
      to: `/login?redirect=${encodeURIComponent('/dashboard')}`,
    });
    expect(decideRoute('/leave/requests', false, null)).toEqual({
      action: 'redirect',
      to: `/login?redirect=${encodeURIComponent('/leave/requests')}`,
    });
  });

  it('gates /admin on the platform_admin role', () => {
    expect(decideRoute('/admin', true, 'platform_admin')).toEqual({ action: 'next' });
    expect(decideRoute('/admin/orgs', true, 'platform_admin')).toEqual({ action: 'next' });
    expect(decideRoute('/admin', true, 'super_admin')).toEqual({ action: 'redirect', to: '/dashboard' });
    expect(decideRoute('/admin/plans', true, 'employee')).toEqual({ action: 'redirect', to: '/dashboard' });
  });

  it('keeps platform staff out of tenant app pages', () => {
    expect(decideRoute('/dashboard', true, 'platform_admin')).toEqual({ action: 'redirect', to: '/admin' });
    expect(decideRoute('/settings', true, 'platform_admin')).toEqual({ action: 'redirect', to: '/admin' });
    expect(decideRoute('/payroll/history', true, 'platform_admin')).toEqual({ action: 'redirect', to: '/admin' });
  });

  it('lets tenant users into tenant pages', () => {
    for (const role of ['employee', 'manager', 'hr_admin', 'super_admin']) {
      expect(decideRoute('/dashboard', true, role)).toEqual({ action: 'next' });
      expect(decideRoute('/attendance', true, role)).toEqual({ action: 'next' });
    }
  });

  it('does not treat prefix-similar paths as tenant pages for platform staff', () => {
    // '/settingsX' is not '/settings' nor '/settings/...'
    expect(decideRoute('/settingsX', true, 'platform_admin')).toEqual({ action: 'next' });
  });
});
