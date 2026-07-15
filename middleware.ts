import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public access to landing page and auth pages without any checks
  const publicPaths = [
    '/', 
    '/signup', 
    '/login', 
    '/auth/account-choice', 
    '/auth/pi/signin', 
    '/auth/pi/callback',
    '/api/auth',
    '/api/products'
  ];

  // Check if current path starts with any public path
  const isPublicPath = publicPaths.some(path => 
    pathname === path || pathname.startsWith(path + '/') || pathname.startsWith('/api/')
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  // For protected routes, check for session cookie
  const sessionCookie = request.cookies.get('session');
  
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
