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

// ─── Content-Security-Policy (report-only) ───────────
// Derive the API origin from the env-driven base URL (see src/lib/api.ts).
// A relative base ('/api/v1') is same-origin, so 'self' already covers it.
function apiOrigin(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
  try {
    return new URL(base).origin;
  } catch {
    return '';
  }
}

// Report-only for now: violations are surfaced in the browser console (and
// to any configured reporting endpoint) without blocking anything. Inline
// script/style must stay allowed until nonces are wired through Next's
// hydration scripts.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  `connect-src 'self'${apiOrigin() ? ` ${apiOrigin()}` : ''}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function withCsp(response: NextResponse): NextResponse {
  response.headers.set('Content-Security-Policy-Report-Only', CSP_REPORT_ONLY);
  return response;
}

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
      return withCsp(NextResponse.redirect(new URL(dest, request.url)));
    }
    return withCsp(NextResponse.next());
  }

  if (!token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return withCsp(NextResponse.redirect(url));
  }

  if (pathname.startsWith('/admin')) {
    if (role !== 'platform_admin') {
      return withCsp(NextResponse.redirect(new URL('/dashboard', request.url)));
    }
    return withCsp(NextResponse.next());
  }

  if (role === 'platform_admin' && TENANT_APP_PREFIXES.some(
    p => pathname === p || pathname.startsWith(`${p}/`),
  )) {
    return withCsp(NextResponse.redirect(new URL('/admin', request.url)));
  }

  return withCsp(NextResponse.next());
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
