import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscriptionInfo, AccountStatus } from './lib/subscription';

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public pages and static assets
  if (pathname === '/login' ||
      pathname === '/signup' ||
      pathname === '/reset-password' ||
      pathname === '/activate-code' ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // Allow auth API routes (login, signup, password reset) without session
  if (pathname.startsWith('/api/auth') && !pathname.includes('/trial-status')) {
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

    // NEW: Check subscription status
    const subscriptionInfo = await getUserSubscriptionInfo(parseInt(sessionData.userId));

    // For API routes, inject company context and subscription status into headers
    if (pathname.startsWith('/api')) {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-company-id', sessionData.companyId);
      requestHeaders.set('x-user-id', sessionData.userId);

      // Inject subscription status
      requestHeaders.set('x-subscription-active', String(subscriptionInfo.has_access));
      requestHeaders.set('x-trial-active', String(subscriptionInfo.account_status === AccountStatus.TRIAL_ACTIVE));
      requestHeaders.set('x-subscription-activated', String(subscriptionInfo.subscription_activated));
      requestHeaders.set('x-account-status', subscriptionInfo.account_status);

      // Block access to protected routes if no subscription
      if (pathname.startsWith('/api/protected') && !subscriptionInfo.has_access) {
        const trialDaysRemaining = subscriptionInfo.trial_expires_at
          ? Math.max(0, Math.ceil((new Date(subscriptionInfo.trial_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0;

        return NextResponse.json(
          {
            error: 'Subscription required',
            account_status: subscriptionInfo.account_status,
            trial_days_remaining: trialDaysRemaining
          },
          { status: 403 }
        );
      }

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    // For page routes, redirect to activation if account is locked
    if (!subscriptionInfo.has_access) {
      const allowedPages = ['/activate-code', '/account', '/login', '/logout'];
      if (!allowedPages.includes(pathname)) {
        return NextResponse.redirect(new URL('/activate-code', req.url));
      }
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
