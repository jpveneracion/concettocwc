import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  // Allow public access to landing page and signup
  const publicPaths = ['/', '/signup', '/login', '/auth/account-choice'];
  
  if (publicPaths.includes(req.nextUrl.pathname)) {
    return NextResponse.next();
  }
  
  // Other routes require authentication
  if (!req.auth) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
