import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public access to landing page and auth pages
  const publicPaths = ['/', '/signup', '/login', '/auth/account-choice', '/auth/pi/signin', '/auth/pi/callback'];

  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Check if user has session cookie for protected routes
  const sessionCookie = request.cookies.get('session');

  // API routes that don't require authentication
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/products')) {
    return NextResponse.next();
  }

  // For other routes, redirect to login if no session
  if (!sessionCookie && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
