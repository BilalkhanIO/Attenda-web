import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtDecode } from 'jwt-decode';

const PUBLIC_PATHS = [
  '/',
  '/about',
  '/contact',
  '/privacy',
  '/blog',
  '/get-started',
  '/login',
  '/reset-password',
  '/setup-account',
  '/forgot-password',
  '/sso',
];

const TENANT_APP_PREFIXES = [
  '/dashboard',
  '/employees',
  '/attendance',
  '/leave',
  '/shifts',
  '/payroll',
  '/performance',
  '/analytics',
  '/remote',
  '/settings',
];

function decodeRole(token: string): string | null {
  try {
    const payload = jwtDecode<{ role?: string; exp?: number }>(token);
    if (payload.exp && payload.exp * 1000 <= Date.now()) return null;
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;
  const role = token ? decodeRole(token) : null;

  const isPublic = PUBLIC_PATHS.some(
    p => p === pathname || (p !== '/' && pathname.startsWith(p)),
  );

  if (isPublic) {
    if (token && (pathname === '/login' || pathname === '/get-started')) {
      const dest = role === 'platform_admin' ? '/admin' : '/dashboard';
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/admin')) {
    if (role !== 'platform_admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (role === 'platform_admin' && TENANT_APP_PREFIXES.some(
    p => pathname === p || pathname.startsWith(`${p}/`),
  )) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
