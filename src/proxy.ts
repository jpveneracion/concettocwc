import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscriptionInfo, AccountStatus, getTrialDaysRemaining } from './lib/subscription';

// Cache TTL: 5 minutes in milliseconds
const SUBSCRIPTION_CACHE_TTL = 5 * 60 * 1000;

interface SessionData {
  userId: number;
  companyId: string;
  subscriptionCache?: {
    data: any;
    timestamp: number;
  };
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public pages and static assets
  if (pathname === '/login' || pathname === '/signup' || pathname === '/reset-password' ||
      pathname === '/activate-code' || pathname.startsWith('/_next') ||
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

  // Parse session and check subscription with caching
  try {
    const sessionData = JSON.parse(session.value) as SessionData;

    // Check if we have cached subscription data that's still fresh
    let subscriptionInfo = sessionData.subscriptionCache?.data;
    const cacheAge = Date.now() - (sessionData.subscriptionCache?.timestamp || 0);

    // If cache is expired or missing, fetch fresh data from database
    if (!subscriptionInfo || cacheAge > SUBSCRIPTION_CACHE_TTL) {
      subscriptionInfo = await getUserSubscriptionInfo(sessionData.userId);

      // Note: We don't update the session cookie here to avoid middleware mutations
      // The cache will be refreshed on the next request after TTL expires
    }

    // For API routes, inject company context and subscription status into headers
    if (pathname.startsWith('/api')) {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-company-id', sessionData.companyId);
      requestHeaders.set('x-user-id', String(sessionData.userId));

      // Inject subscription status headers for downstream API handlers
      requestHeaders.set('x-subscription-active', String(subscriptionInfo.has_access));
      requestHeaders.set('x-trial-active', String(subscriptionInfo.account_status === AccountStatus.TRIAL_ACTIVE));
      requestHeaders.set('x-subscription-activated', String(subscriptionInfo.subscription_activated));
      requestHeaders.set('x-account-status', subscriptionInfo.account_status);

      // Block access to protected routes if no subscription access
      if (pathname.startsWith('/api/protected') && !subscriptionInfo.has_access) {
        return NextResponse.json(
          {
            error: 'Subscription required',
            account_status: subscriptionInfo.account_status,
            trial_days_remaining: getTrialDaysRemaining(subscriptionInfo.trial_expires_at)
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

    // For page routes, redirect locked users to activation page
    // Allow access to subscription-related pages even when account is locked
    if (!subscriptionInfo.has_access) {
      const allowedPages = ['/activate-code', '/account', '/login', '/logout'];
      if (!allowedPages.includes(pathname)) {
        return NextResponse.redirect(new URL('/activate-code', req.url));
      }
    }

    // For page routes, continue normal request processing
    return NextResponse.next();
  } catch {
    // Invalid session - treat as unauthorized
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }
}