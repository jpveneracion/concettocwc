import { NextRequest, NextResponse } from 'next/server';

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public pages and static assets
  if (pathname === '/login' || pathname === '/signup' || pathname === '/reset-password' || pathname.startsWith('/_next') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // Allow auth API routes (login, signup, password reset) without session
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = req.cookies.get('session');

  if (!session) {
    // For API routes, return 401 instead of redirect
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // For page routes, redirect to login
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Parse session and inject company info into headers for API routes
  try {
    const sessionData = JSON.parse(session.value);

    // For API routes, inject company context into headers
    if (pathname.startsWith('/api')) {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-company-id', sessionData.companyId);
      requestHeaders.set('x-user-id', sessionData.userId);

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    // For page routes, just continue
    return NextResponse.next();
  } catch {
    // Invalid session
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }
}