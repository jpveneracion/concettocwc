import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest & { auth?: any }) {
  // Allow public access to landing page and auth pages
  const publicPaths = [
    '/',
    '/signup',
    '/login',
    '/auth/account-choice',
    '/auth/pi/signin',
    '/auth/pi/callback',
    '/api/products',
    '/api/logout',
    '/api/login',
    '/api/signup'
  ];

  // Check if current path is a public path
  const isPublicPath = publicPaths.some(path =>
    req.nextUrl.pathname === path || req.nextUrl.pathname.startsWith(path + '/')
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  // For protected routes, check authentication
  if (!req.auth) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};