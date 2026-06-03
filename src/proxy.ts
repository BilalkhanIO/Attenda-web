import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  '/sso'
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => p === pathname || (p !== '/' && pathname.startsWith(p)))) {
    // Redirect authenticated users away from login/get-started to dashboard
    if (token && (pathname === '/login' || pathname === '/get-started')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Redirect to login if no token
  if (!token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
